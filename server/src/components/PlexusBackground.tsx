'use client';

import React, { useRef, useEffect } from 'react';
// p5 must be imported as a default export since it doesn't have a default export by default in the package.json "module" field
import p5 from 'p5'; 

// --- P5.js Sketch Logic ---
const sketch = (p: p5) => {
    let particles: Particle[] = [];
    const NUM_PARTICLES = 300;
    const MAX_DISTANCE = 110;
    const MOVE_SPEED = 1.0;
    const PARTICLE_COLOR = [237, 114, 47]; // Soft Gold/Yellow

    class Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        radius: number = 1;

        constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
            this.vx = p.random(-MOVE_SPEED, MOVE_SPEED);
            this.vy = p.random(-MOVE_SPEED, MOVE_SPEED);
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > p.width) this.vx *= -1;
            if (this.y < 0 || this.y > p.height) this.vy *= -1;
        }

        display() {
            p.fill(PARTICLE_COLOR[0], PARTICLE_COLOR[1], PARTICLE_COLOR[2]);
            p.noStroke();
            p.ellipse(this.x, this.y, this.radius * 2);
        }

        connect(other: Particle) {
            const d = p.dist(this.x, this.y, other.x, other.y);

            if (d < MAX_DISTANCE) {
                const alpha = p.map(d, 0, MAX_DISTANCE, 255, 0);
                p.stroke(PARTICLE_COLOR[0], PARTICLE_COLOR[1], PARTICLE_COLOR[2], alpha);
                p.strokeWeight(0.5);
                p.line(this.x, this.y, other.x, other.y);
            }
        }
    }

    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        for (let i = 0; i < NUM_PARTICLES; i++) {
            particles.push(new Particle(p.random(p.width), p.random(p.height)));
        }
    };

    p.draw = () => {
        p.background(0, 0, 0);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].display();

            for (let j = i + 1; j < particles.length; j++) {
                particles[i].connect(particles[j]);
            }
        }
    };

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
};

// --- React Component Wrapper ---
const PlexusBackground: React.FC = () => {
    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            // p5 instance creation
            const p5Instance = new p5(sketch, canvasRef.current);

            return () => {
                p5Instance.remove();
            };
        }
    }, []); 

    return (
        <div ref={canvasRef} className="absolute inset-0 z-0">
            {/* The p5 canvas will be attached here */}
        </div>
    );
};

export default PlexusBackground;