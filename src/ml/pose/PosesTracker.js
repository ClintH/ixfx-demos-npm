import {Lines,Points} from '../../ixfx/geometry.js';
import * as Types from '../lib/Types.js';
import * as Coco from '../lib/Coco.js';
import { PoseTracker } from './PoseTracker.js';

/**
 * @typedef {Readonly<{
 * maxAgeMs:number
 * resetAfterSamples:number
 * sampleLimit:number
 * storeIntermediate:boolean
 * }>} PosesTrackerOptions
 */

/**
 * Tracks several poses
 * 
 * Events:
 * - expired: Tracked pose has not been seen for a while
 * - added: A new pose id
 */
export class PosesTracker {
  /** 
   * PoseTrackers, keyed by 'sender-pose.id'
   * @type Map<string,PoseTracker> */
  #data = new Map();

  /** @type PosesTrackerOptions */
  #options;

  events = new EventTarget();


  /**
   * 
   * @param {Partial<PosesTrackerOptions>} options 
   */
  constructor(options = {}) {
    this.#options = {
      maxAgeMs: 10_000,
      resetAfterSamples: 0,
      sampleLimit: 100,
      storeIntermediate:false,
      ...options
    };
    setInterval(() => {
      // Delete expired poses
      const expired = [...this.#data.entries()].filter(entry=>entry[1].elapsed > this.#options.maxAgeMs);
      for (const entry of expired) {
        this.#data.delete(entry[0]);
        this.events.dispatchEvent(new CustomEvent(`expired`, {detail:entry[1]}));
      }
    }, 1000);
  }

  /**
   * Enumerates each of the PoseTrackers
   * (ie. one for each body).
   * Use getValuesByAge() to enumerate raw pose data
   */
  *getTrackersByAge() {
    const trackers = [...this.#data.values()];
    trackers.sort((a,b)=>a.elapsed-b.elapsed);
    yield* trackers.values();
  }

  *getTrackers() {
    const trackers = [...this.#data.values()];
    yield* trackers.values();
  }

  /**
   * Enumerate the last set of raw pose data for
   * each of the PoseTrackers.
   */
  *getValuesByAge() {
    for (const tracker of this.getTrackersByAge()) {
      yield tracker.last;
    }  
  }

  *getValues() {
    const values = [...this.#data.values()];
    for (const tracker of values) {
      yield tracker.last;
    }  
  }

  /**
   * Returns all PoseTrackers originating from a particular sender
   * @param {string} senderId 
   */
  *getFromSender(senderId) {
    const values = [...this.#data.values()];
    for (const tracker of values) {
      if (tracker.fromId === senderId) yield tracker;
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.#data.clear();
  }

  /**
   * Enumerate the set of unique sender ids
   */
  *getSenderIds() {
    const set = new Set();
    const values = [...this.#data.values()];
    for (const entry of values) {
      set.add(entry.fromId);
    }
    yield* set.values();
  }

  /**
   * Returns the PoseTracker for this pose id.
   * Warning: Pose ids are not unique if there are multiple data sources.
   * Prefer using guids.
   * @param {string} id 
   * @returns 
   */
  getTrackerByPoseId(id) {
    for (const entry of this.#data.values()) {
      if (entry.poseId === id) return entry;
    }
  }

  /**
   * Returns the last raw pose data for this pose id.
   * Warning: Pose ids are not unique if there are multiple data sources.
   * Prefer using guids.
   * @param {string} id 
   */
  getValueByPoseId(id) {
    for (const entry of this.#data.values()) {
      if (entry.poseId === id) return entry.last;
    }
  }

  /**
   * Enumerate the set of globally-unique ids of poses
   */
  *getGuids() {
    for (const t of this.#data.values()) {
      yield t.guid;
    }
  }

  /**
   * Get the PoseTracker for unique id
   * (fromId-poseId)
   * @param {string} id 
   * @returns 
   */
  getTrackerByGuid(id) {
    return this.#data.get(id);
  }

  getValueByGuid(id) {
    return this.#data.get(id)?.last;
  }

  /**
   * Track a pose.
   * Fires `added` event if it is a new pose.
   * Returns the globally-unique id for this pose
   * @param {Types.Pose} pose 
   * @param {string} from
   */
  seen(from, pose) {
    if (from === undefined) throw new Error(`Parameter 'from' is undefined`);
    if (pose === undefined) throw new Error(`Parameter 'pose' is undefined`);
    const id = (pose.id ?? 0).toString();
    const nsId = from+`-`+id;
    let tp = this.#data.get(nsId);
    if (tp === undefined) {
      tp = new PoseTracker(from, id, this.#options);
      this.#data.set(nsId, tp);
      tp.seen(pose);
      this.events.dispatchEvent(new CustomEvent(`added`, {detail:tp}));
    } else {
      tp.seen(pose);
    }
    return nsId;
  }

  /**
   * Return number of tracked poses
   */
  get size() {
    return this.#data.size;
  }
}

/**
 * Returns a line between two named keypoints
 * @param {Types.Pose} pose 
 * @param {string} a 
 * @param {string} b 
 * @returns {Lines.Line|undefined}
 */
export const lineBetween = (pose, a, b) => {
  const ptA = Coco.getKeypoint(pose, a);
  const ptB = Coco.getKeypoint(pose, b);
  if (ptA === undefined) return;
  if (ptB === undefined) return;
  return Object.freeze({
    a: ptA,
    b: ptB
  });
};

/**
 * Returns the rough center of a pose, based on
 * the chest coordinates
 * @param {Types.Pose} pose 
 */
export const roughCenter = (pose) => {
  const a = lineBetween(pose, `left_shoulder`, `right_hip`);
  const b = lineBetween(pose, `right_shoulder`, `left_hip`);
  if (a === undefined) return;
  if (b === undefined) return;

  // Get halfway of each line
  const halfA = Lines.interpolate(0.5,a);
  const halfB = Lines.interpolate(0.5,b);

  // Add them up
  const sum = Points.sum(halfA, halfB);

  // Divide to get avg
  return Points.divide(sum,2,2);
};
