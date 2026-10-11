"""
TUNTUNE SYNC - bilgisayardan telefona kablosuz müzik aktarımı.

Telefonda: TUNTUNE -> Settings -> Wi-Fi transfer ekranını aç.
Bilgisayarda: bu programı çalıştır. Telefon aynı Wi-Fi ağında otomatik bulunur.

Sadece Python 3.8+ gerekir. Sürükle-bırak için isteğe bağlı:  pip install tkinterdnd2
"""

from __future__ import annotations

import http.client
import json
import os
import queue
import socket
import sys
import threading
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

HTTP_PORT = 8765
DISCOVERY_PORT = 8766
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wav"}
CONFIG_PATH = Path.home() / ".tuntune_sync.json"
CHUNK = 64 * 1024


# --------------------------------------------------------------------------- Ayarlar

def load_config() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_config(cfg: dict) -> None:
    try:
        CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


# --------------------------------------------------------------------------- Ağ

@dataclass
class Phone:
    name: str
    host: str
    port: int = HTTP_PORT

    def label(self) -> str:
        return f"{self.name}  //  {self.host}"


def _broadcast_targets() -> list[str]:
    """255.255.255.255 + her yerel IPv4 adresinin /24 yayın adresi."""
    targets = {"255.255.255.255"}
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127."):
                targets.add(".".join(ip.split(".")[:3] + ["255"]))
    except Exception:
        pass
    try:  # varsayılan ağ arayüzü
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        targets.add(".".join(ip.split(".")[:3] + ["255"]))
    except Exception:
        pass
    return sorted(targets)


def discover(timeout: float = 2.0) -> list[Phone]:
    """Aynı ağdaki TUNTUNE telefonlarını bulur."""
    found: dict[str, Phone] = {}
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(0.3)
    try:
        for target in _broadcast_targets():
            try:
                sock.sendto(b"TUNTUNE_DISCOVER", (target, DISCOVERY_PORT))
            except OSError:
                pass
        end = time.time() + timeout
        while time.time() < end:
            try:
                data, addr = sock.recvfrom(512)
            except socket.timeout:
                continue
            except OSError:
                break
            parts = data.decode("utf-8", "replace").split("|")
            if len(parts) >= 3 and parts[0] == "TUNTUNE":
                try:
                    port = int(parts[2])
                except ValueError:
                    port = HTTP_PORT
                found[addr[0]] = Phone(parts[1], addr[0], port)
    finally:
        sock.close()
    return list(found.values())


class PhoneError(Exception):
    def __init__(self, message: str, status: int = 0, needs_confirm: bool = False):
        super().__init__(message)
        self.status = status
        self.needs_confirm = needs_confirm


class PhoneClient:
    """Telefondaki TUNTUNE alıcısıyla konuşur."""

    def __init__(self, host: str, port: int, code: str):
        self.host = host
        self.port = port
        self.code = code.strip()

    def _conn(self, timeout: float = 15) -> http.client.HTTPConnection:
        return http.client.HTTPConnection(self.host, self.port, timeout=timeout)

    @staticmethod
    def _read(resp: http.client.HTTPResponse) -> dict:
        raw = resp.read()
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except ValueError:
            body = {}
        if resp.status >= 400:
            raise PhoneError(body.get("error", f"HTTP {resp.status}"), resp.status, bool(body.get("needsConfirm")))
        return body

    def _request(self, method: str, path: str) -> dict:
        conn = self._conn()
        try:
            conn.request(method, path, headers={"X-TT-Code": self.code})
            return self._read(conn.getresponse())
        except (OSError, http.client.HTTPException) as e:
            raise PhoneError(f"Bağlantı hatası: {e}") from e
        finally:
            conn.close()

    def info(self) -> dict:
        return self._request("GET", "/api/info")

    def songs(self) -> list[dict]:
        return self._request("GET", "/api/songs").get("songs", [])

    def delete(self, song_id: int) -> dict:
        return self._request("DELETE", f"/api/songs/{song_id}")

    def upload(self, path: Path, progress=None, cancel: threading.Event | None = None) -> dict:
        """Dosyayı parça parça gönderir. progress(gönderilen, toplam)."""
        size = path.stat().st_size
        conn = self._conn(timeout=120)
        try:
            conn.putrequest("PUT", "/api/upload?name=" + urllib.parse.quote(path.name))
            conn.putheader("X-TT-Code", self.code)
            conn.putheader("Content-Type", "application/octet-stream")
            conn.putheader("Content-Length", str(size))
            conn.endheaders()
            sent = 0
            with open(path, "rb") as f:
                while True:
                    if cancel is not None and cancel.is_set():
                        raise PhoneError("İptal edildi")
                    chunk = f.read(CHUNK)
                    if not chunk:
                        break
                    conn.send(chunk)
                    sent += len(chunk)
                    if progress:
                        progress(sent, size)
            return self._read(conn.getresponse())
        except (OSError, http.client.HTTPException) as e:
            raise PhoneError(f"Gönderilemedi: {e}") from e
        finally:
            conn.close()


# --------------------------------------------------------------------------- Dosya işleri

def collect_audio(paths) -> list[Path]:
    """Dosya ve klasörlerden ses dosyalarını toplar (alt klasörler dahil)."""
    result: list[Path] = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            for root, _dirs, files in os.walk(p):
                for name in sorted(files):
                    fp = Path(root) / name
                    if fp.suffix.lower() in AUDIO_EXTENSIONS:
                        result.append(fp)
        elif p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS:
            result.append(p)
    seen = set()
    unique = []
    for fp in result:
        key = str(fp.resolve()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(fp)
    return unique


def missing_on_phone(local_files: list[Path], phone_songs: list[dict]) -> list[Path]:
    """Telefonda aynı isim + boyutta olmayan dosyalar."""
    on_phone = {(s.get("filename", "").lower(), int(s.get("size", -1))) for s in phone_songs}
    return [f for f in local_files if (f.name.lower(), f.stat().st_size) not in on_phone]


def human_size(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} GB"


def human_duration(ms: int) -> str:
    s = max(0, int(ms) // 1000)
    return f"{s // 60:02d}:{s % 60:02d}"


# --------------------------------------------------------------------------- Arayüz

def run_gui() -> None:  # pragma: no cover - arayüz
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    try:
        from tkinterdnd2 import DND_FILES, TkinterDnD  # type: ignore
        root = TkinterDnD.Tk()
        dnd = True
    except Exception:
        root = tk.Tk()
        dnd = False

    # ---- Renkler ve yazı tipi
    BG, PANEL, PANEL2, LINE = "#000000", "#101216", "#1A1D23", "#2A2F37"
    TEXT, DIM, FAINT = "#E8E8EA", "#8C929B", "#555B64"
    ACCENTS = {"MONO": "#F2F2F2", "YELLOW": "#FCEE0A", "CYAN": "#00F0FF", "PINK": "#FF2A6D", "GREEN": "#39FF14"}

    cfg = load_config()
    ACCENT = ACCENTS.get(cfg.get("accent", "YELLOW"), "#FCEE0A")

    font_family = "Consolas"
    fonts_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "fonts"
    if sys.platform == "win32" and fonts_dir.is_dir():
        try:
            import ctypes
            for ttf in fonts_dir.glob("*.ttf"):
                ctypes.windll.gdi32.AddFontResourceExW(str(ttf), 0x10, 0)  # FR_PRIVATE
            font_family = "Chakra Petch"
        except Exception:
            pass

    def F(size, weight="normal"):
        return (font_family, size, weight)

    root.title("TUNTUNE SYNC")
    root.configure(bg=BG)
    root.geometry("880x700")
    root.minsize(760, 560)

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure(".", background=BG, foreground=TEXT, fieldbackground=PANEL, bordercolor=LINE, font=F(10))
    style.configure("TNotebook", background=BG, borderwidth=0)
    style.configure("TNotebook.Tab", background=PANEL, foreground=DIM, padding=(18, 8), font=F(10, "bold"), borderwidth=0)
    style.map("TNotebook.Tab", background=[("selected", ACCENT)], foreground=[("selected", "#000000")])
    style.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=TEXT, rowheight=26, borderwidth=0)
    style.map("Treeview", background=[("selected", PANEL2)], foreground=[("selected", ACCENT)])
    style.configure("Treeview.Heading", background=BG, foreground=DIM, font=F(9, "bold"), borderwidth=0)
    style.configure("Horizontal.TProgressbar", troughcolor=PANEL, background=ACCENT, bordercolor=LINE, lightcolor=ACCENT, darkcolor=ACCENT)
    style.configure("TCombobox", fieldbackground=BG, background=PANEL, foreground=TEXT, arrowcolor=ACCENT, bordercolor=LINE)
    style.map("TCombobox", fieldbackground=[("readonly", BG), ("!disabled", BG)], foreground=[("!disabled", TEXT)])
    root.option_add("*TCombobox*Listbox.background", PANEL)
    root.option_add("*TCombobox*Listbox.foreground", TEXT)
    root.option_add("*TCombobox*Listbox.selectBackground", ACCENT)
    root.option_add("*TCombobox*Listbox.selectForeground", "#000000")
    style.configure("TCheckbutton", background=BG, foreground=TEXT, font=F(10))
    style.map("TCheckbutton", background=[("active", BG)])

    def button(parent, text, cmd, primary=False):
        b = tk.Button(
            parent, text=text.upper(), command=cmd, font=F(10, "bold"),
            bg=ACCENT if primary else PANEL, fg="#000000" if primary else TEXT,
            activebackground=ACCENT, activeforeground="#000000",
            relief="flat", bd=0, padx=16, pady=7, cursor="hand2",
            highlightthickness=1, highlightbackground=ACCENT if primary else LINE,
        )
        return b

    def label(parent, text, size=10, color=TEXT, weight="normal", bg=BG, var=None, **kw):
        return tk.Label(parent, text=text, textvariable=var, font=F(size, weight), fg=color, bg=bg, anchor="w", **kw)

    ui_queue: queue.Queue = queue.Queue()

    def ui(fn, *args):
        """Arka plan iş parçacığından arayüzü güvenle günceller."""
        ui_queue.put((fn, args))

    def pump():
        try:
            while True:
                fn, args = ui_queue.get_nowait()
                fn(*args)
        except queue.Empty:
            pass
        root.after(80, pump)

    state = {"client": None, "phones": [], "busy": False, "cancel": threading.Event(), "songs": []}

    # ---- Başlık
    header = tk.Frame(root, bg=BG)
    header.pack(fill="x", padx=20, pady=(18, 6))
    label(header, "◤ WI-FI LINK", 9, ACCENT, "bold").pack(anchor="w")
    label(header, "TUNTUNE SYNC", 24, TEXT, "bold").pack(anchor="w")
    tk.Frame(root, bg=LINE, height=1).pack(fill="x", padx=20, pady=(4, 10))

    # ---- Bağlantı paneli
    conn_frame = tk.Frame(root, bg=PANEL, highlightthickness=1, highlightbackground=LINE)
    conn_frame.pack(fill="x", padx=20)
    row1 = tk.Frame(conn_frame, bg=PANEL)
    row1.pack(fill="x", padx=14, pady=(12, 4))
    label(row1, "PHONE", 9, DIM, "bold", PANEL).pack(side="left")
    phone_var = tk.StringVar(value="Aranıyor...")
    phone_box = ttk.Combobox(row1, textvariable=phone_var, width=38, font=F(10), state="normal")
    phone_box.pack(side="left", padx=10)
    label(row1, "CODE", 9, DIM, "bold", PANEL).pack(side="left", padx=(10, 0))
    code_var = tk.StringVar(value=cfg.get("code", ""))
    code_entry = tk.Entry(row1, textvariable=code_var, width=6, font=F(14, "bold"), bg=BG, fg=ACCENT,
                          insertbackground=ACCENT, relief="flat", highlightthickness=1, highlightbackground=LINE, justify="center")
    code_entry.pack(side="left", padx=10)
    connect_btn = button(row1, "Connect", lambda: connect(), primary=True)
    connect_btn.pack(side="left", padx=(6, 0))
    button(row1, "Scan", lambda: scan()).pack(side="left", padx=8)

    status_var = tk.StringVar(value="LINK // OFFLINE")
    status_label = label(conn_frame, "", 9, DIM, "bold", PANEL, var=status_var)
    status_label.pack(fill="x", padx=14, pady=(2, 12))

    def set_status(text, color=DIM):
        status_var.set(text)
        status_label.configure(fg=color)

    # ---- Alt ilerleme çubuğu (önce yerleştirilir ki her zaman görünsün)
    bottom = tk.Frame(root, bg=BG)
    bottom.pack(side="bottom", fill="x", padx=20, pady=(0, 16))
    progress_text = tk.StringVar(value="")
    label(bottom, "", 9, DIM, var=progress_text).pack(fill="x")
    progress = ttk.Progressbar(bottom, mode="determinate", maximum=1000)
    progress.pack(fill="x", pady=(4, 0))

    # ---- Sekmeler
    tabs = ttk.Notebook(root)
    tabs.pack(fill="both", expand=True, padx=20, pady=12)
    send_tab = tk.Frame(tabs, bg=BG)
    sync_tab = tk.Frame(tabs, bg=BG)
    phone_tab = tk.Frame(tabs, bg=BG)
    tabs.add(send_tab, text="01 SEND")
    tabs.add(sync_tab, text="02 SYNC")
    tabs.add(phone_tab, text="03 PHONE")

    # ================================================================ SEND
    drop = tk.Frame(send_tab, bg=PANEL, highlightthickness=1, highlightbackground=ACCENT, height=150)
    drop.pack(fill="x", padx=2, pady=(12, 8))
    drop.pack_propagate(False)
    drop_text = "▼  ŞARKILARI VEYA KLASÖRLERİ BURAYA SÜRÜKLE" if dnd else "DOSYA EKLE / KLASÖR EKLE İLE ŞARKI SEÇ"
    label(drop, drop_text, 13, ACCENT, "bold", PANEL).place(relx=0.5, rely=0.42, anchor="center")
    hint = "mp3 · m4a · flac · ogg · opus · wav" if dnd else "Sürükle-bırak için:  pip install tkinterdnd2"
    label(drop, hint, 9, DIM, "normal", PANEL).place(relx=0.5, rely=0.65, anchor="center")

    send_buttons = tk.Frame(send_tab, bg=BG)
    send_buttons.pack(fill="x", pady=(0, 8))
    button(send_buttons, "Dosya ekle", lambda: add_files()).pack(side="left")
    button(send_buttons, "Klasör ekle", lambda: add_folder()).pack(side="left", padx=8)
    button(send_buttons, "Durdur", lambda: state["cancel"].set()).pack(side="right")

    queue_tree = ttk.Treeview(send_tab, columns=("size", "status"), show="tree headings", height=8)
    queue_tree.heading("#0", text="FILE")
    queue_tree.heading("size", text="SIZE")
    queue_tree.heading("status", text="STATUS")
    queue_tree.column("#0", width=480)
    queue_tree.column("size", width=90, anchor="e")
    queue_tree.column("status", width=150)
    queue_tree.pack(fill="both", expand=True)

    pending: list[tuple[str, Path]] = []

    def enqueue(files: list[Path]):
        for f in files:
            iid = queue_tree.insert("", "end", text=f.name, values=(human_size(f.stat().st_size), "QUEUED"))
            pending.append((iid, f))
        start_sending()

    def add_files():
        paths = filedialog.askopenfilenames(
            title="Şarkı seç",
            filetypes=[("Ses dosyaları", " ".join("*" + e for e in sorted(AUDIO_EXTENSIONS))), ("Tümü", "*.*")],
        )
        if paths:
            enqueue(collect_audio(paths))

    def add_folder():
        path = filedialog.askdirectory(title="Klasör seç")
        if path:
            enqueue(collect_audio([path]))

    if dnd:
        def on_drop(event):
            enqueue(collect_audio(root.tk.splitlist(event.data)))
        for w in (drop, *drop.winfo_children()):
            w.drop_target_register(DND_FILES)
            w.dnd_bind("<<Drop>>", on_drop)

    def start_sending():
        if state["busy"] or not pending:
            return
        client: PhoneClient | None = state["client"]
        if client is None:
            set_status("LINK // ÖNCE TELEFONA BAĞLAN", ACCENT)
            return
        state["busy"] = True
        state["cancel"].clear()
        threading.Thread(target=send_worker, args=(client,), daemon=True).start()

    def send_worker(client: PhoneClient):
        done = skipped = failed = 0
        while pending and not state["cancel"].is_set():
            iid, path = pending.pop(0)
            ui(queue_tree.set, iid, "status", "SENDING")
            ui(queue_tree.see, iid)
            try:
                def prog(sent, total, name=path.name):
                    ui(progress.configure, {"value": sent * 1000 / max(total, 1)})
                    ui(progress_text.set, f"{name}  //  {human_size(sent)} / {human_size(total)}")
                res = client.upload(path, prog, state["cancel"])
                if res.get("skipped"):
                    skipped += 1
                    ui(queue_tree.set, iid, "status", "= ALREADY ON PHONE")
                else:
                    done += 1
                    ui(queue_tree.set, iid, "status", "✓ DONE")
            except PhoneError as e:
                failed += 1
                ui(queue_tree.set, iid, "status", "✗ " + str(e)[:30])
        if state["cancel"].is_set():
            for iid, _p in pending:
                ui(queue_tree.set, iid, "status", "CANCELLED")
            pending.clear()
        ui(progress.configure, {"value": 0})
        ui(progress_text.set, f"✓ {done} gönderildi   = {skipped} zaten vardı   ✗ {failed} hata")
        state["busy"] = False
        ui(refresh_phone)

    # ================================================================ SYNC
    label(sync_tab, "SENKRON KLASÖRÜ", 9, DIM, "bold").pack(anchor="w", pady=(14, 4))
    folder_row = tk.Frame(sync_tab, bg=BG)
    folder_row.pack(fill="x")
    folder_var = tk.StringVar(value=cfg.get("sync_folder", ""))
    tk.Entry(folder_row, textvariable=folder_var, font=F(10), bg=PANEL, fg=TEXT, insertbackground=ACCENT,
             relief="flat", highlightthickness=1, highlightbackground=LINE).pack(side="left", fill="x", expand=True, ipady=6)
    button(folder_row, "Seç", lambda: pick_folder()).pack(side="left", padx=8)

    auto_var = tk.BooleanVar(value=bool(cfg.get("auto_sync", True)))
    ttk.Checkbutton(sync_tab, text="Bağlanınca otomatik senkronla", variable=auto_var,
                    command=lambda: persist()).pack(anchor="w", pady=10)

    sync_info = tk.StringVar(value="Bilgisayardaki klasörde olup telefonda olmayan şarkılar gönderilir. Telefondan hiçbir şey silinmez.")
    label(sync_tab, "", 10, DIM, var=sync_info, wraplength=760, justify="left").pack(fill="x", pady=(4, 10))
    button(sync_tab, "Şimdi senkronla", lambda: sync_now(), primary=True).pack(anchor="w")

    def pick_folder():
        path = filedialog.askdirectory(title="Senkron klasörünü seç")
        if path:
            folder_var.set(path)
            persist()

    def sync_now():
        client: PhoneClient | None = state["client"]
        folder = folder_var.get().strip()
        if client is None:
            set_status("LINK // ÖNCE TELEFONA BAĞLAN", ACCENT)
            return
        if not folder or not Path(folder).is_dir():
            sync_info.set("Önce geçerli bir klasör seç.")
            return
        sync_info.set("Karşılaştırılıyor...")

        def work():
            try:
                local = collect_audio([folder])
                songs = client.songs()
                todo = missing_on_phone(local, songs)
            except PhoneError as e:
                ui(sync_info.set, f"Hata: {e}")
                return
            if not todo:
                ui(sync_info.set, f"✓ Senkron. Klasördeki {len(local)} şarkının hepsi telefonda.")
                return
            ui(sync_info.set, f"{len(local)} şarkıdan {len(todo)} tanesi telefonda yok, gönderiliyor...")
            ui(tabs.select, send_tab)
            ui(enqueue, todo)

        threading.Thread(target=work, daemon=True).start()

    # ================================================================ PHONE
    top_row = tk.Frame(phone_tab, bg=BG)
    top_row.pack(fill="x", pady=(12, 8))
    search_var = tk.StringVar()
    tk.Entry(top_row, textvariable=search_var, font=F(10), bg=PANEL, fg=TEXT, insertbackground=ACCENT,
             relief="flat", highlightthickness=1, highlightbackground=LINE).pack(side="left", fill="x", expand=True, ipady=6)
    button(top_row, "Yenile", lambda: refresh_phone()).pack(side="left", padx=8)
    button(top_row, "Seçilenleri sil", lambda: delete_selected()).pack(side="left")

    phone_tree = ttk.Treeview(phone_tab, columns=("artist", "album", "time", "size"), show="tree headings")
    for col, text, width, anchor in (
        ("#0", "TITLE", 260, "w"), ("artist", "ARTIST", 170, "w"), ("album", "ALBUM", 170, "w"),
        ("time", "TIME", 60, "e"), ("size", "SIZE", 80, "e"),
    ):
        phone_tree.heading(col, text=text)
        phone_tree.column(col, width=width, anchor=anchor)
    phone_tree.pack(fill="both", expand=True)
    phone_count = tk.StringVar(value="")
    label(phone_tab, "", 9, DIM, var=phone_count).pack(fill="x", pady=(6, 0))

    def fill_phone_tree(*_):
        q = search_var.get().strip().lower()
        phone_tree.delete(*phone_tree.get_children())
        shown = 0
        for s in state["songs"]:
            hay = f"{s.get('title', '')} {s.get('artist', '')} {s.get('album', '')}".lower()
            if q and q not in hay:
                continue
            phone_tree.insert("", "end", iid=str(s["id"]), text=s.get("title", ""),
                              values=(s.get("artist", ""), s.get("album", ""),
                                      human_duration(s.get("duration", 0)), human_size(s.get("size", 0))))
            shown += 1
        total = sum(int(s.get("size", 0)) for s in state["songs"])
        phone_count.set(f"{shown} / {len(state['songs'])} şarkı  //  toplam {human_size(total)}")

    search_var.trace_add("write", fill_phone_tree)

    def refresh_phone():
        client: PhoneClient | None = state["client"]
        if client is None:
            return

        def work():
            try:
                songs = client.songs()
            except PhoneError as e:
                ui(phone_count.set, f"Hata: {e}")
                return
            state["songs"] = songs
            ui(fill_phone_tree)

        threading.Thread(target=work, daemon=True).start()

    def delete_selected():
        client: PhoneClient | None = state["client"]
        ids = phone_tree.selection()
        if client is None or not ids:
            return
        if not messagebox.askyesno("TUNTUNE SYNC", f"{len(ids)} şarkı telefondan silinsin mi?"):
            return

        def work():
            ok = confirm = failed = 0
            for iid in ids:
                try:
                    client.delete(int(iid))
                    ok += 1
                except PhoneError as e:
                    if e.needs_confirm:
                        confirm += 1
                    else:
                        failed += 1
            msg = f"✓ {ok} silindi"
            if confirm:
                msg += f"   ⚠ {confirm} şarkı için telefonda 'Onayla' butonuna bas"
            if failed:
                msg += f"   ✗ {failed} hata"
            ui(phone_count.set, msg)
            time.sleep(0.5)
            ui(refresh_phone)

        threading.Thread(target=work, daemon=True).start()

    # ================================================================ Bağlantı
    def persist():
        cfg.update({
            "code": code_var.get().strip(),
            "sync_folder": folder_var.get().strip(),
            "auto_sync": bool(auto_var.get()),
            "last_host": state.get("last_host", cfg.get("last_host", "")),
        })
        save_config(cfg)

    def scan():
        set_status("LINK // SCANNING...", ACCENT)

        def work():
            phones = discover()
            state["phones"] = phones

            def show():
                labels = [p.label() for p in phones]
                phone_box.configure(values=labels)
                if phones:
                    phone_var.set(labels[0])
                    set_status(f"LINK // {len(phones)} TELEFON BULUNDU · KODU GİR VE CONNECT'E BAS", ACCENT)
                    if code_var.get().strip() and state["client"] is None:
                        connect()
                else:
                    if cfg.get("last_host"):
                        phone_var.set(cfg["last_host"])
                    set_status("LINK // TELEFON BULUNAMADI · Telefonda Wi-Fi transfer ekranı açık mı? IP adresini elle de yazabilirsin.", DIM)
            ui(show)

        threading.Thread(target=work, daemon=True).start()

    def resolve_host() -> tuple[str, int]:
        text = phone_var.get().strip()
        for p in state["phones"]:
            if p.label() == text:
                return p.host, p.port
        host = text.split("//")[-1].strip()
        if ":" in host:
            h, port = host.rsplit(":", 1)
            return h.strip(), int(port)
        return host, HTTP_PORT

    def connect():
        code = code_var.get().strip()
        if len(code) != 4 or not code.isdigit():
            set_status("LINK // TELEFONDAKİ 4 HANELİ KODU GİR", ACCENT)
            return
        try:
            host, port = resolve_host()
        except ValueError:
            set_status("LINK // ADRES GEÇERSİZ", ACCENT)
            return
        set_status(f"LINK // BAĞLANIYOR {host}...", ACCENT)

        def work():
            client = PhoneClient(host, port, code)
            try:
                info = client.info()
            except PhoneError as e:
                msg = "KOD YANLIŞ" if e.status == 401 else str(e)
                ui(set_status, f"LINK // {msg}", ACCENT)
                return
            state["client"] = client
            state["last_host"] = host
            ui(persist)
            ui(set_status, f"LINK // CONNECTED  ·  {info.get('name', 'PHONE')}  ·  {host}", ACCENT)
            ui(refresh_phone)
            ui(start_sending)
            if auto_var.get() and folder_var.get().strip():
                ui(sync_now)

        threading.Thread(target=work, daemon=True).start()

    code_entry.bind("<Return>", lambda _e: connect())
    root.protocol("WM_DELETE_WINDOW", lambda: (persist(), state["cancel"].set(), root.destroy()))
    root.after(80, pump)
    root.after(300, scan)
    root.mainloop()


if __name__ == "__main__":
    run_gui()
