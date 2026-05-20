// ──────────────────────────────────────────────
//  arm.js  —  機械手臂動畫控制器
//  使用 GSAP 做平滑補間動畫
// ──────────────────────────────────────────────
import * as THREE from 'three';
import { CELL, BLOCK_STATES, ROTATE_MAP, LAY_FLAT_MAP, SIDE_DOWN_MAP, STAND_UP_MAP } from './config.js';

const LIFT_HEIGHT = 5.5;   // 抬起高度（世界座標 Y）
const TRAVEL_DUR  = 0.7;   // 水平移動時間（秒）
const LOWER_DUR   = 0.35;  // 下降時間

export class Arm {
  constructor(scene) {
    this.scene  = scene;
    this.heldBlock = null;

    // 手臂抓手（視覺元素）
    this._buildArmMesh();

    // 抓手初始位置（停在場景外角落）
    this.claw.position.set(10, 3, 10);
  }

  // ── 建立視覺模型 ─────────────────────────────
  _buildArmMesh() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x99aacc,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x445588,
      emissiveIntensity: 0.15,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.85,
    });

    // 抓手底座（小球）
    this.claw = new THREE.Group();

    const bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      metalMat,
    );
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.06, 8, 20),
      glowMat,
    );
    glowRing.rotation.x = Math.PI / 2;

    // 抓手爪（4 個小矩形）
    const clawMat = new THREE.MeshStandardMaterial({ color: 0xccddff, metalness: 0.9, roughness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), clawMat);
      const angle = (i / 4) * Math.PI * 2;
      finger.position.set(Math.cos(angle) * 0.3, -0.4, Math.sin(angle) * 0.3);
      this.claw.add(finger);
    }

    this.claw.add(bodyMesh, glowRing);
    this.scene.add(this.claw);

    // 細線：從手臂到抓手（動態更新）
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(10, 8, 10),
      new THREE.Vector3(10, 3, 10),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6688aa, transparent: true, opacity: 0.5 });
    this.wire = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.wire);

    // 動畫 tick 時更新細線
    this._wireTop = new THREE.Vector3(10, 16, 10);
  }

  _updateWire() {
    const pts = [this._wireTop, this.claw.position.clone()];
    this.wire.geometry.setFromPoints(pts);
  }

  // ── 核心動畫流程 ─────────────────────────────
  async grab(block) {
    const gsap = window.gsap;
    const target = block.worldPos;

    // 1. 移動到積木上方
    await gsap.to(this.claw.position, {
      x: target.x, z: target.z,
      y: LIFT_HEIGHT,
      duration: TRAVEL_DUR,
      ease: 'power2.inOut',
      onUpdate: () => this._updateWire(),
    });

    // 2. 下降到積木頂面
    await gsap.to(this.claw.position, {
      y: block.topY + 0.2,
      duration: LOWER_DUR,
      ease: 'power1.in',
      onUpdate: () => this._updateWire(),
    });

    // 3. 抓住積木
    this.heldBlock = block;
    block.isHeld   = true;

    // 4. 連同積木一起抬起
    await gsap.to(this.claw.position, {
      y: LIFT_HEIGHT + block.height,
      duration: LOWER_DUR,
      ease: 'power1.out',
      onUpdate: () => {
        block.mesh.position.y = this.claw.position.y - block.height / 2;
        this._updateWire();
      },
    });
  }

  async rotateBlock(actionName) {
    if (!this.heldBlock) return;
    const gsap   = window.gsap;
    const block  = this.heldBlock;
    const oldState = block.state;
    let newState;

    switch (actionName) {
      case 'rotate':   newState = ROTATE_MAP[oldState];   break;
      case 'layFlat':  newState = LAY_FLAT_MAP[oldState]; break;
      case 'sideDown': newState = SIDE_DOWN_MAP[oldState]; break;
      case 'standUp':  newState = STAND_UP_MAP[oldState]; break;
      default: return oldState;
    }

    // 旋轉動畫（繞 Y 軸）  
    await gsap.to(block.mesh.rotation, {
      y: block.mesh.rotation.y + Math.PI / 2,
      duration: 0.45,
      ease: 'back.out(1.4)',
    });

    block.changeState(newState);
    block.mesh.rotation.y = 0; // 重置旋轉（新 geometry 已對齊）

    // 因狀態改變，抓手要跟著積木高度調整
    this.claw.position.y = LIFT_HEIGHT + block.height;
    this._updateWire();

    return newState;
  }

  async place(gridX, gridZ, stackY, blocks) {
    const gsap  = window.gsap;
    const block = this.heldBlock;
    if (!block) return;

    const destX = gridX * CELL;
    const destZ = gridZ * CELL;
    const destY = stackY + block.height / 2;

    // 1. 水平移動
    await gsap.to(this.claw.position, {
      x: destX, z: destZ,
      duration: TRAVEL_DUR,
      ease: 'power2.inOut',
      onUpdate: () => {
        block.mesh.position.x = this.claw.position.x;
        block.mesh.position.z = this.claw.position.z;
        this._updateWire();
      },
    });

    // 2. 下降放置
    await gsap.to(this.claw.position, {
      y: destY + 0.2,
      duration: LOWER_DUR * 1.2,
      ease: 'power1.in',
      onUpdate: () => {
        block.mesh.position.y = this.claw.position.y - block.height / 2;
        this._updateWire();
      },
    });

    // 3. 放開積木
    block.setGridPos(gridX, gridZ, stackY);
    block.isHeld   = false;
    block.isPlaced = true;
    this.heldBlock = null;

    // 4. 抬起收回
    await gsap.to(this.claw.position, {
      y: LIFT_HEIGHT,
      duration: LOWER_DUR,
      ease: 'power1.out',
      onUpdate: () => this._updateWire(),
    });

    // 5. 回到待機位置
    gsap.to(this.claw.position, {
      x: 10, z: 10,
      duration: TRAVEL_DUR * 0.8,
      ease: 'power2.inOut',
      onUpdate: () => this._updateWire(),
    });
  }

  // ── 錯誤動畫（積木震動） ───────────────────
  async playError(block) {
    const gsap = window.gsap;
    const origX = block.mesh.position.x;
    await gsap.to(block.mesh.position, {
      x: origX + 0.4,
      duration: 0.08,
      yoyo: true,
      repeat: 5,
      ease: 'power1.inOut',
    });
    block.mesh.position.x = origX;
  }

  // ── 完成動畫（積木發光） ───────────────────
  async playSuccess(blocks) {
    const gsap = window.gsap;
    for (const b of blocks) {
      gsap.to(b.mesh.material, {
        emissiveIntensity: 0.8,
        duration: 0.3,
        yoyo: true,
        repeat: 3,
        onStart: () => {
          b.mesh.material.emissive.set(0xffffff);
          b.mesh.material.emissiveIntensity = 0;
        },
      });
    }
    await gsap.delayedCall(1.5, () => {});
  }

  /** 釋放目前抓著的積木（退回原位） */
  releaseHeld() {
    if (!this.heldBlock) return;
    this.heldBlock.isHeld = false;
    this.heldBlock = null;
  }
}
