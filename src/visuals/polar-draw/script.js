import * as Dom from '../../ixfx/dom.js';
import { scaler } from '../../ixfx/data.js';
import { Oscillators } from '../../ixfx/modulation.js';
import { continuously } from '../../ixfx/flow.js';
import { Points, Polar, Scaler, degreeToRadian } from '../../ixfx/geometry.js';

const settings = Object.freeze({
  /**
   * Creates a scaler function for arm length.
   * It will scale 0 ... 1 to a 0.1 ... 0.8 scale
   * This means arm length minimum will be 10% and max 80%
   */
  armLengthScale: scaler(0, 1, 0.1, 0.8),
  /**
   * Rotation per-frame, in radians
   */
  rotationPerFrame: degreeToRadian(0.1),
  /**
   * If true, the drawing arm is drawn
   */
  drawArm: true,
  /**
 * Position arm at the middle, bottom of screen
 */
  armOrigin: { x: 0.5, y: 1 },
  // Sine wave oscillator that modulates length of drawing arm
  osc: Oscillators.sine(100)
});

let state = Object.freeze({
  /** @type number */
  rotation: 0,
  /**
   * Current absolute position of arm.
   * A line made up of two points.
   */
  armAbsolute: {
    a: { x: 0, y: 0 },
    b: { x: 0, y: 0 }
  },
  /** 
   * Angle of arm in radians
   */
  armAngle: degreeToRadian(-90),
  bounds: { width: 0, height: 0 },
  /** @type number */
  scaleBy: 1,
  /** @type {CanvasRenderingContext2D|undefined} */
  drawingCtx: undefined,
  middleAbs: { x: 0, y: 0 },
  /** @type {OffscreenCanvas|undefined} */
  bufferCanvas: undefined,
  scale: Scaler.
});

/**
 * Update state
 * This calculates everything necessary for drawing (in the 'use' function)
 */
const update = () => {
  const { rotationPerFrame, armOrigin, osc, armLengthScale } = settings;
  const { rotation, scaleBy, armAngle } = state;


  // Default arm length - will be overriden by oscillator value
  let armLength = 0.5;

  // Modulate length of arm
  // 1. Get current value from the oscillator
  const oscillatorValue = osc.next().value;
  // 2. Scale value (if valid) according to the allowed range of the arm length
  if (oscillatorValue) {
    armLength = armLengthScale(oscillatorValue);
  }

  // Relative coordinate of arm end
  const armEnd = Polar.toCartesian(armLength, armAngle, armOrigin);

  // Calculate absolute position of arm start & end
  const armAbsolute = {
    // Start
    a: Points.multiplyScalar(armOrigin, scaleBy),
    // End
    b: Points.multiplyScalar(armEnd, scaleBy)
  };


  saveState({
    // Save current arm position
    armAbsolute,
    // Increase rotation
    rotation: rotation + rotationPerFrame
  });
};

const use = async () => {
  const { drawingCtx, bounds, rotation, armAbsolute, middleAbs, bufferCanvas } = state;

  if (!bufferCanvas) return; // No image buffer for some reason
  const bufferCtx = bufferCanvas.getContext(`2d`);
  if (!drawingCtx || !bufferCtx) return; // No drawing contexts

  // Draw on buffer
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  bufferCtx.fillStyle = `white`;
  bufferCtx.font = `bold 48px serif`;
  bufferCtx.fillText(`!Hello there`, 100, 0);

  // Draw buffer on canvas
  drawingCtx.drawImage(bufferCanvas, 0, 200);
  // Make a copy of the buffer
  //  const bufferContents = await createImageBitmap(bufferCtx.createImageData(bounds.width, bounds.height));

  //bufferCtx.drawImage(bufferContents, 0, 0);
  //bufferCtx.reset();


  //bufferCtx.resetTransform();
  // Translate to arm end
  // bufferCtx.save();
  // bufferCtx.translate(armAbsolute.b.x, armAbsolute.b.y);
  // drawAtArmEnd(bufferCtx);
  // bufferCtx.resetTransform();

  // // Translate & rotate canvas
  // drawingCtx.save();
  // drawingCtx.translate(middleAbs.x, middleAbs.y);
  // drawingCtx.rotate(rotation);

  // // Draw the buffer
  // drawingCtx.drawImage(drawBuffer, 0, 0);

  // // Undo transforms
  // drawingCtx.resetTransform();

  // if (settings.drawArm) drawArm(drawingCtx);

};

/**
 * Draw whatever is meant to be at the tip of the drawing arm
 * @param {OffscreenCanvasRenderingContext2D} ctx
 */
const drawAtArmEnd = (ctx) => {
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = `yellow`;
  ctx.fill();
  ctx.closePath();
};

/**
 * Draws the drawing arm
 * @param {CanvasRenderingContext2D} ctx
 * @returns
 */
const drawArm = (ctx) => {
  const { armAbsolute } = state;

  ctx.strokeStyle = `hsla(0,0,100%,0.1)`;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.lineCap = `round`;
  ctx.moveTo(armAbsolute.a.x, armAbsolute.a.y);
  ctx.lineTo(armAbsolute.b.x, armAbsolute.b.y);

  ctx.stroke();
  ctx.closePath();
};

function setup() {
  const initBuffer = () => {
    // Create a new offscreen canvas, making it larger than viewport
    const c = new OffscreenCanvas(state.bounds.width, state.bounds.height);
    saveState({
      bufferCanvas: c
    });
  };

  // Dom.fullSizeCanvas(`#canvas`, args => {
  //   const scaleBy = Math.min(args.bounds.width, args.bounds.height);
  //   saveState({
  //     bounds: args.bounds,
  //     drawingCtx: args.ctx,
  //     scaleBy,
  //     middleAbs: Points.multiplyScalar({ x: 0.5, y: 0.5 }, scaleBy)
  //   });
  //   initBuffer();
  // });
  resizeCanvas(`#canvas`, opts => {
    saveState({
      bounds: opts.size,
      drawingCtx: opts.ctx,
      scale: opts.scale
    });
  });

  continuously(async () => {
    update();
    await use();
  }).start();
};
setup();


/**
 * 
 * @param {HTMLElement|string} domQueryOrEl 
 * @param {(opts:{size:{width:number,height:number}, ctx:CanvasRenderingContext2D, scale:Scaler.Scaler})=>void} callback 
 */
function resizeCanvas(domQueryOrEl, callback) {
  /** @type {HTMLCanvasElement} */
  const el = Dom.resolveEl(domQueryOrEl);
  const go = () => {
    const size = el.getBoundingClientRect();
    const ctx = el.getContext(`2d`);
    el.width = size.width * devicePixelRatio;
    el.height = size.height * devicePixelRatio;
    ctx?.scale(devicePixelRatio, devicePixelRatio);
    el.style.width = size.width + `px`;
    el.style.height = size.height + `px`;

    callback({
      ...size, ctx, scale: Scaler.scaler(`min`, size)
    });
  };
  window.addEventListener(`resize`, () => go());
  go();
}

/**
 * Save state
 * @param {Partial<state>} s 
 */
function saveState(s) {
  state = Object.freeze({
    ...state,
    ...s
  });
}

