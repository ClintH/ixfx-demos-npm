import * as Dom from '../../ixfx/dom.js';
import { Forces } from '../../ixfx/modulation.js';
import { Drawing } from '../../ixfx/visual.js';
import { Points, Rects, Shapes } from '../../ixfx/geometry.js';
import { repeat } from '../../ixfx/flow.js';

const settings = Object.freeze({
  // Visual option for attractor
  attractorRadius: 50,
  // Visual options for attractees
  arrowOpts: {
    tailThickness: 15,
    tailLength: 50,
    arrowSize: 40
  },
  // Gravity: power of attractor
  gravity: 0.0005,
  // Orientation force. A lower interpolation amt reduces quickness of turn
  orientationForce: Forces.orientationForce(1)
});

let state = Object.freeze({
  attractor: {
    position: { x: 0.5, y: 0.5 },
    mass: 1,
    angle: Math.random() * Math.PI * 2
  },
  bounds: {
    width: 0,
    height: 0,
    center: { x: 0, y: 0 }
  },
  /** @type readonly Forces.ForceAffected[] */
  attractees: [ ...repeat(20, generate) ],
});

const onTick = () => {
  const { gravity, orientationForce } = settings;
  const { attractees, attractor } = state;

  // Apply forces: all attractees, one attractor
  let attracteesAltered = attractees.map(a => Forces.apply(a,
    Forces.computeAttractionForce(attractor, a, gravity),
    orientationForce
  ));

  // Force between attractees
  const f = Forces.attractionForce(attracteesAltered, gravity);

  // Make attractess work on each other too
  attracteesAltered = attracteesAltered.map(a => Forces.apply(a, f));

  // Set new state
  updateState({ attractees: attracteesAltered });
};

/**
 * Draws a circle
 * @param {{position:Points.Point, mass:number}} a 
 * @param {CanvasRenderingContext2D} context 
 * @param {Rects.Rect} bounds 
 * @param {number} radius 
 * @param {string} fillStyle 
 */
const circle = (a, context, bounds, radius = 10, fillStyle = `black`) => {
  if (a === undefined) throw new Error(`a is undefined`);
  const pt = Points.multiply(a.position, bounds);
  radius = 5 + (radius * (a.mass ?? 1));
  context.save();
  context.translate(pt.x, pt.y);
  context.fillStyle = fillStyle;
  context.beginPath();
  context.ellipse(-radius / 2, -radius / 2, radius, radius, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

/**
 * Draws an arrow
 * @param {{position:Points.Point, angle:number}} a 
 * @param {CanvasRenderingContext2D} context 
 * @param {Rects.Rect} bounds 
 */
const arrow = (a, context, bounds) => {
  const pt = Points.multiply(a.position, bounds);

  // Translate so 0,0 is the point of the attractee
  context.save();
  context.translate(pt.x, pt.y);

  // Drawing options for this arrow
  const options = {
    angleRadian: a.angle,
    ...settings.arrowOpts
  };

  // Shapes.arrow returns a set of points...
  const arrow = Shapes.arrow({ x: 0, y: 0 }, `middle`, options);

  // Helper function that draws a path, connecting points
  Drawing.connectedPoints(context, arrow, { strokeStyle: `firebrick`, loop: true });

  // Restore translation
  context.restore();
};

const useState = () => {
  const canvas = /** @type {HTMLCanvasElement|null} */(document.querySelector(`#canvas`));
  const { attractorRadius } = settings;
  const { attractor, attractees, bounds } = state;
  
  /** @type {CanvasRenderingContext2D|null|undefined} */
  const context = canvas?.getContext(`2d`);
  if (!context) return;

  // Gold background
  context.fillStyle = `gold`;
  context.fillRect(0, 0, bounds.width, bounds.height);
  
  // Draw attractees as arrows
  for (const a of attractees) {
    // @ts-ignore
    arrow(a, context, bounds);
  }

  // Draw main attraction
  circle(attractor, context, bounds, attractorRadius, `LightGoldenrodYellow`);
};

const setup = () => {
  Dom.fullSizeCanvas(`#canvas`, arguments_ => {
    // Update state with new size of canvas
    updateState({ bounds: arguments_.bounds });
  });

  const loop = () => {
    onTick();
    useState();
    window.requestAnimationFrame(loop);
  };
  loop();

  document.addEventListener(`pointermove`, event => {
    // If there's no click/touch, not interested
    if (event.buttons === 0) return;

    // Compute relative pointer position
    const position = Points.divide({ x: event.x, y: event.y }, state.bounds);

    // Move attractor to relative pointer position
    updateState({
      attractor: {
        ...state.attractor,
        position
      }
    }); 
  });
};
setup();

/**
 * Update state
 * @param {Partial<state>} s 
 */
function updateState (s) {
  state = Object.freeze({
    ...state,
    ...s
  });
}

/**
 * Create a random thing.
 * Declared as a function so it is callable in `settings` init.
 * @returns 
 */
function generate() {
  return {
    position: Points.random(),
    mass: Math.random() / 20,
    angle: Math.PI,
    angularAcceleration: 0
  };
}