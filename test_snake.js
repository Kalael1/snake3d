import * as THREE from 'three';
import { Snake } from './src/Snake.js';

const scene = new THREE.Scene();
const snake = new Snake(scene);

const targetPoint = new THREE.Vector3(0, 0, 0);
let delta = 0.016;

console.log("Initial Head Pos:", snake.getHeadPosition());

for (let i = 0; i < 50; i++) {
    snake.update(delta, targetPoint);
    console.log(`Step ${i+1}: Head Pos =`, snake.getHeadPosition(), "Direction =", snake.direction);
}
