/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Few different shades of red.
 */
const colors = [`#AD0701`, `#D98E8B`, `#6F0501`];

/**
 * Get a random color, but the each weighed differently.
 * 0: 69%
 * 1: 16%
 * 2: 15%
 */
const randomColor = () => {
  const c = Math.random();
  if (c > 0.3) {
    return colors[0];
  }

  if (c > 0.15) {
    return colors[1];
  }

  return colors[2];
};

function getRandomIntInclusive(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * This is ponyfill for requestAnimationFrame,this ensure we
 * only work on frames that will be rendered by the browser.
 *
 * This keeps the browser responsive while keeping our
 * animations smooth to the user.
 * @param {Function} fn
 */

function delay(fn: () => void): void {
  if (`requestAnimationFrame` in window) {
    requestAnimationFrame(fn);
  } else {
    setTimeout(fn, 0);
  }
}

type PixelArray = SVGRectElement[];

/**
 * We keep track of when the initial animation is finished.
 * If not all event listeners do thing.
 */
let inited = false;
function init(pixels: PixelArray) {
  if (!pixels) {
    return;
  }

  /**
   * Render each pixel at their randomized position from the starting location.
   */
  rerender(pixels);
  locations.forEach((_, i) => {
    setTimeout(() => {
      if (!pixels || !pixels[i] || pixels[i] === null) {
        return;
      }

      /**
       * Ensure each pixel is visible to the user.
       */
      pixels[i]!.setAttribute(`visibility`, `visible`);
      /**
       * Correctly set the color of the pixel to whatever was generated for it.
       */
      pixels[i]!.setAttribute(`fill`, locations[i][2]);
      /**
       * Store the current time. This is used to animated
       * all of our pixels back to their starting locations.
       */
      const t = Date.now();
      /**
       *
       * @param n Index of the pixel.
       * @param x Where the pixel started (x).
       * @param y Where the pixel started (y).
       * @param x1 Where the pixel is moving to (x).
       * @param y1 Where the pixel is moving to (y).
       */
      const animate = (
        n: number,
        x: number,
        y: number,
        x1: number,
        y1: number
      ) => {
        /**
         * Calcuate the amount of time that has
         * elasped since this animation started.
         */
        const past = Date.now() - t;
        /**
         * Calcuate the percent of where we are in the animation.
         * The initial animation is 500ms.
         * So if are currently animated the 100ms time, then dt would be 0.2 or 20%.
         */
        let dt = past / 500;
        /**
         * Calcuate the amount we have to move
         * the pixel to get to its desired location.
         */
        const dx = x1 - x;
        const dy = y1 - y;
        /**
         * If we are done with the animation,
         * we force set the position of the
         * pixel to be where is supposed to be.
         *
         * If this is the last pixel to finish being animated, we also set our
         * `inited` flag so that the pixel can be further animated by the user.
         *
         * If the animation is not complete (dt < 1), then we calcuate where the pixel is supposed
         * to be based on how much time has elapsed using one of our easing functions.
         *
         * These functions return a percent of where it should be,
         * so we use this percentage to calcucate its real position.
         */
        if (dt >= 1) {
          locations[n][0] = x1;
          locations[n][1] = y1;
          if (i === locations.length - 1) {
            inited = true;
          }
        } else {
          /**
           * dt used to be the percentage of the time elsaped,
           * now it has an easing function applied to it.
           *
           * ? We could remove this and replace 0, 1 with x, x1 but then we would have
           * ? to call the easing function twice. Not sure if there would be a performance hit or not.
           */
          dt = EasingFunctions.easeOutExpo(null, past, 0, 1, 500);
          /**
           * Using our eased dt we calculate where the next position is.
           */
          locations[n][0] = x + dx * dt;
          locations[n][1] = y + dy * dt;
          /**
           * After we render this frame, calcuate the next frame.
           */
          delay(() => {
            animate(n, x, y, x1, y1);
          });
        }
      };

      const [x, y] = locations[i];
      const [x1, y1] = startLocations[i];
      delay(() => animate(i, x, y, x1, y1));
    }, 15 * i);
  });

  const render = () => {
    if (!inited) {
      rerender(pixels);
      delay(render);
    }
  };

  render();
  delay(render);
}

/**
 * Sets the current positions in
 * the locations array to its corresponding pixel.
 */
function rerender(pixels: PixelArray) {
  pixels.forEach((a, i) => {
    if (!a || a === null) {
      return;
    }

    a.setAttribute(`x`, `${locations[i][0] + 25}`);
    a.setAttribute(`y`, `${locations[i][1] + 38}`);
  });
}

const EasingFunctions = {
  /**
   *
   * @param x null
   * @param t Start Time
   * @param b Start Value
   * @param c End Value
   * @param d Total Time
   */
  easeOutExpo(x: null, t: number, b: number, c: number, d: number) {
    return t === d ? b + c : c * (-Math.pow(2, (-10 * t) / d) + 1) + b;
  },
  /**
   *
   * @param x null
   * @param t Start Time
   * @param b Start Value
   * @param c End Value
   * @param d Total Time
   */
  easeOutElastic(x: null, t: number, b: number, c: number, d: number): number {
    let s = 1.70158;
    let p = 0;
    let a = c;
    if (t === 0) {
      return b;
    }

    // eslint-disable-next-line no-cond-assign
    if ((t /= d) === 1) {
      return b + c;
    }

    if (!p) {
      p = d * 0.3;
    }

    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = (p / (2 * Math.PI)) * Math.asin(c / a);
    }

    return (
      a * Math.pow(2, -10 * t) * Math.sin(((t * d - s) * (2 * Math.PI)) / p) +
      c +
      b
    );
  },
};

function listener(pixels: PixelArray, i: number) {
  if (!inited) {
    return;
  }

  if (locations[i][3]) {
    return;
  }

  let other: number | undefined;
  while (!other) {
    const t = getRandomIntInclusive(0, locations.length - 1);
    if (!locations[t][3]) {
      other = t;
    }
  }

  locations[i][3] = true;
  locations[other][3] = true;
  const t = Date.now();
  const animate = (n: number, x: number, y: number, x1: number, y1: number) => {
    const past = Date.now() - t;
    let dt = past / 2000;
    const dx = x1 - x;
    const dy = y1 - y;
    if (dt >= 1) {
      locations[n][0] = x1;
      locations[n][1] = y1;
      locations[i][3] = false;
      locations[other!][3] = false;
    } else {
      dt = EasingFunctions.easeOutElastic(null, past, 0, 1, 2000);
      locations[n][0] = x + dx * dt;
      locations[n][1] = y + dy * dt;
      delay(() => {
        animate(n, x, y, x1, y1);
      });
    }

    rerender(pixels);
  };

  const [x, y] = locations[i];
  const [x1, y1] = locations[other];
  animate(i, x, y, x1, y1);
  animate(other, x1, y1, x, y);
}

/**
 * The starting postion of every pixel. This is what correctly spells out
 * `A-1 Motion`.
 * Each pixel has the following structure:
 * [
 *   x,        The position where the pixel should be render at next,
 *   y,        this includes the postions inbetween the start and end animations.
 *   color,    The color of the pixel, this is constant and generated once at runtime.
 *   isMoving  Flag that determines if a pixel is moving, which disables all events for that pixel.
 * ]
 */
const startLocations: Array<[number, number, string, boolean]> = [
  [0, 0, randomColor(), false],
  [5, 0, randomColor(), false],
  [10, 0, randomColor(), false],
  [15, 0, randomColor(), false],
  [20, 0, randomColor(), false],
  [0, 5, randomColor(), false],
  [20, 5, randomColor(), false],
  [0, 10, randomColor(), false],
  [20, 10, randomColor(), false],
  [5, 10, randomColor(), false],
  [10, 10, randomColor(), false],
  [15, 10, randomColor(), false],
  [0, 15, randomColor(), false],
  [20, 15, randomColor(), false],
  [0, 20, randomColor(), false],
  [20, 20, randomColor(), false],
  [30, 10, randomColor(), false],
  [35, 10, randomColor(), false],
  [40, 10, randomColor(), false],
  [55, 5, randomColor(), false],
  [60, 0, randomColor(), false],
  [60, 5, randomColor(), false],
  [60, 10, randomColor(), false],
  [60, 15, randomColor(), false],
  [55, 20, randomColor(), false],
  [60, 20, randomColor(), false],
  [65, 20, randomColor(), false],
  [85, 0, randomColor(), false],
  [85, 5, randomColor(), false],
  [85, 10, randomColor(), false],
  [85, 15, randomColor(), false],
  [85, 20, randomColor(), false],
  [90, 5, randomColor(), false],
  [95, 10, randomColor(), false],
  [100, 5, randomColor(), false],
  [105, 0, randomColor(), false],
  [105, 5, randomColor(), false],
  [105, 10, randomColor(), false],
  [105, 15, randomColor(), false],
  [105, 20, randomColor(), false],
  [115, 0, randomColor(), false],
  [120, 0, randomColor(), false],
  [125, 0, randomColor(), false],
  [130, 0, randomColor(), false],
  [135, 0, randomColor(), false],
  [115, 5, randomColor(), false],
  [135, 5, randomColor(), false],
  [115, 10, randomColor(), false],
  [135, 10, randomColor(), false],
  [115, 15, randomColor(), false],
  [135, 15, randomColor(), false],
  [115, 20, randomColor(), false],
  [120, 20, randomColor(), false],
  [125, 20, randomColor(), false],
  [130, 20, randomColor(), false],
  [135, 20, randomColor(), false],
  [145, 0, randomColor(), false],
  [150, 0, randomColor(), false],
  [155, 0, randomColor(), false],
  [160, 0, randomColor(), false],
  [165, 0, randomColor(), false],
  [155, 5, randomColor(), false],
  [155, 10, randomColor(), false],
  [155, 15, randomColor(), false],
  [155, 20, randomColor(), false],
  [175, 0, randomColor(), false],
  [180, 0, randomColor(), false],
  [185, 0, randomColor(), false],
  [180, 5, randomColor(), false],
  [180, 10, randomColor(), false],
  [180, 15, randomColor(), false],
  [180, 20, randomColor(), false],
  [175, 20, randomColor(), false],
  [185, 20, randomColor(), false],
  [195, 0, randomColor(), false],
  [200, 0, randomColor(), false],
  [205, 0, randomColor(), false],
  [210, 0, randomColor(), false],
  [215, 0, randomColor(), false],
  [195, 5, randomColor(), false],
  [215, 5, randomColor(), false],
  [195, 10, randomColor(), false],
  [215, 10, randomColor(), false],
  [195, 15, randomColor(), false],
  [215, 15, randomColor(), false],
  [195, 20, randomColor(), false],
  [200, 20, randomColor(), false],
  [205, 20, randomColor(), false],
  [210, 20, randomColor(), false],
  [215, 20, randomColor(), false],
  [225, 0, randomColor(), false],
  [225, 5, randomColor(), false],
  [225, 10, randomColor(), false],
  [225, 15, randomColor(), false],
  [225, 20, randomColor(), false],
  [230, 5, randomColor(), false],
  [235, 10, randomColor(), false],
  [240, 15, randomColor(), false],
  [245, 20, randomColor(), false],
  [245, 15, randomColor(), false],
  [245, 10, randomColor(), false],
  [245, 5, randomColor(), false],
  [245, 0, randomColor(), false],
];
/**
 * This is a mutatable version of the locations above.
 */
const locations: typeof startLocations = JSON.parse(
  JSON.stringify(startLocations)
);
/**
 * At the start, we randomly move each pixel a little bit.
 * After we start, we animate them all back to their starting postion.
 */
locations.forEach((a) => {
  a[0] = a[0] + getRandomIntInclusive(-50, 50);
  a[1] = a[1] + getRandomIntInclusive(-25, 25);
});

App.init().then(() => {
  const svg = $(`#hero`);
  const pixels: SVGRectElement[] = svg.find(`rect`).toArray() as any;
  init(pixels);
  svg.on(`click mouseover`, `rect`, function a() {
    const pixels: SVGRectElement[] = svg.find(`rect`).toArray() as any;
    listener(pixels, Number($(this).data(`index`)));
  });
});
