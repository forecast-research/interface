import { consent, instructions } from './instructions';
import { calculateBonus, totalBonus, scoreForPrediction, getForecastModes, totalTaskScore } from './price';
import { beforeTaskSurvey, afterInstructionsSurvey, shouldRunAfterInstructionsSurvey, shouldRunBeforeTaskSurvey } from './survey';
import roundTexts from "./round-texts";

//Audio parametres init
let hitData = {
  accumulated: [],
  initTime: null, // LOCAL experiment start time.
  consentTime: null, // Time consent button clicked
  startTime: null, // Time experiment started
  surveyTime: null, // Time survey started
  validationSurvey: null,
  surveyData: [],
};

const GREEN = "hsl(120, 100%, 50%)";
const BLUE = "hsl(240, 100%, 50%)";
const BLACK = "hsl(0, 0%, 0%)";
  let blockRender = false;

// ---[ HELPER FUNCTIONS ]-------------------------------------------------------

function isLastRoundFn(data, task) {
  return data.round === task.testingRounds + task.trainingRounds + 1;
}

function generateFutureRealizations(data, task) {
  const maxForecastMode = Math.max(
    ...task.forecastMode.split("+").map((x) => parseInt(x))
  );

  const newValues = new Array(maxForecastMode)
    .fill(0)
    .map((v) => getNextRealization(data.values, task.rho, task.sigma, task.mu));

  data.values.push(...newValues);

  for (let p = 0; p < data.predictions.length; p++) {
    const scores = [];
    if (data.predictions[p].active != null)
      scores.push(
        Math.round(
          scoreForPrediction(task, data.predictions[p].active, newValues[p])
        )
      );

    if (data.predictions[p].last != null)
      scores.push(
        Math.round(
          scoreForPrediction(task, data.predictions[p].last, newValues[p])
        )
      );

    let h = $("#score-history");
    let oh = $("#score-outer-bar");
    let st = $("#score-text");

    let scoreStr = " (";
    for (let i = 0; i < scores.length; ++i) {
      data.score += scores[i];
      var cl = i == 0 ? "p1b" : "p2b";
      if (i > 0) scoreStr += ", ";
      scoreStr += '<span class="' + cl + '">+' + scores[i] + "</span>";
    }
    scoreStr += ")";

    if (scoreStr !== " ()") {
      h.append(scoreStr);
      animate(
        500,
        0.01,
        function (f) {
          var x = Math.floor(Math.round(f * 256));
          if (x < 0) x = 0;
          else if (x > 255) x = 255;
          var ix = 255 - x;
          var hex = "0123456789abcdef";
          var code = hex[x >> 4] + hex[x & 0xf];
          var str = "#" + code + "ff" + code;
          var str2 = "rgba(" + x + ",255," + x + ",0.85)";
          oh.css("backgroundColor", str);
          st.css("backgroundColor", str2);
        },
        function () {
          oh.css("backgroundColor", "#ffffff");
          st.css("backgroundColor", "rgba(255,255,255,0.85)");
        }
      );
    }
  }
}

function createResults (hitData, tasks) {
  const result = {
    now: new Date().getTime(),
    values: hitData.accumulated.map((data) => data.values),
    predictions: hitData.accumulated.map((data) => {
      const predictions = [];
      for (var i = 0; i < data.predhist.length; ++i) {
        var p = data.predhist[i];
        predictions.push(p.first);
        predictions.push(p.second);
      }
      return predictions;
    }),
    validationSurvey: hitData.accumulated.map((data) => data.validationSurvey),
    longRunningAveragePredHist: hitData.accumulated.map(
      (d) => d.longRunningAveragePredHist
    ),
    longRunningAveragePredTimingHist: hitData.accumulated.map((d) =>
      d.longRunningAveragePredTimingHist.map((t) => (t - hitData.startTime) / 1000)
    ),
    consentTime: (hitData.consentTime - hitData.initTime) / 1000.0,
    instructionTime: (hitData.startTime - hitData.consentTime) / 1000.0,
    predictionTimes: hitData.accumulated.map((data) => {
      const predictionTimes = [];
      for (var i = 0; i < data.predhist.length; ++i) {
        var p = data.predhist[i];
        if (p.when1 == null) {
          predictionTimes.push(-999999);
        } else {
          predictionTimes.push((p.when1 - hitData.startTime) / 1000.0);
        }
        if (p.when2 == null) {
          predictionTimes.push(-999999);
        } else {
          predictionTimes.push((p.when2 - hitData.startTime) / 1000.0);
        }
        predictionTimes.push((p.when - hitData.startTime) / 1000.0);
      }
      return predictionTimes;
    }),
    experimentTime: (hitData.surveyTime - hitData.startTime) / 1000.0,
    surveyTime: (new Date().getTime() - hitData.surveyTime) / 1000.0,
    surveyData: hitData.surveyData,
  };

  result.score = hitData.accumulated.map((data, i) =>
    totalTaskScore(i, { ...result, tasks: tasks })
  );

  return result;
}

function resetScroll(element) {
  element.scrollLeft = 0;
}

function transitionBetweenTask(taskN, average) {
  $("#instruction-page").clearQueue().fadeOut(500);
  $("#experiment-page").fadeTo(500, 0).delay(200).fadeTo(500, 1);
}

function showBetweenTaskMessage(condition, taskN, average) {
  $("#between-task-page #content > div").html(`

    <h5>Part ${taskN + 1}</h5><p>${roundTexts?.[condition]?.[taskN] ?? 'Part is starting'}</p>
`);
  $("#instruction-page").clearQueue().fadeOut(500);
  $("#between-task-page").show().removeClass('hide');
  $("#experiment-page").fadeTo(500, 0);
}

function fadeRecent(canvas, context, port) {
  const startFadeAt = canvas.width - 87.5;
  const stopFadeAt = startFadeAt - 10 * 35;
  drawFadeOut(canvas, context, startFadeAt, stopFadeAt);
  drawRectOnTop(canvas, context, stopFadeAt, 0);
}

function fadeRecentReverse(canvas, context, port) {
  const stopFadeAt = canvas.width - 87.5;
  const startFadeAt = stopFadeAt - 15 * 35;
  drawFadeOut(canvas, context, startFadeAt, stopFadeAt);
}

function fadeDistant (canvas, context, port) {
  const startFadeAt = (canvas.width - 87.5 - 6 * 35);
  const stopFadeAt = startFadeAt - 8 * 35;
  drawFadeOut(canvas, context, startFadeAt, stopFadeAt);
  drawRectOnTop(canvas, context, stopFadeAt, 0);
}

function drawRectOnTop(canvas, context, start, end) {
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.fillRect(
    Math.min(start, end),
    0,
    Math.max(start, end),
    canvas.height
  );
}

function drawFadeOut(canvas, context, start, end) {
  const gradient = context.createLinearGradient(
    Math.min(start, end),
    0,
    Math.max(start, end),
    0,
  );
  gradient.addColorStop(start > end ? 1 : 0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(start > end ? 0 : 1, "rgba(255, 255, 255, 0.9)");
  context.fillStyle = gradient;
  context.fillRect(Math.min(start, end), 0, Math.abs(end - start), canvas.height);
}

function getPointColor(
  points,
  point,
  nearMouse,
  { clickt, clickt10 },
  condition,
) {
  let i = point;
  let N = points.length;
  let fill = GREEN;
  let stroke = BLACK;
  if (!clickt10 && clickt && condition !== "S6" && i == N - 1) {
    fill = BLUE;
  } else if (clickt10 && i == N - 11) {
    fill = BLUE;
  }
  return nearMouse ? { fill: "#ff0000", stroke: BLACK } : { fill, stroke };
}

function isNearMouse(mousePosition, point) {
  if (mousePosition) {
    var dx = mousePosition.x - point.x;
    var dy = mousePosition.y - point.y;
    var d = dx * dx + dy + dy;
    return d < 36;
  }
  return false;
}

// ---[ ERROR HANDLING ]-------------------------------------------------------

export var fatalError = function (message) {
  $(".page").hide();
  $("#error-page").show();
  $("#error-message").text(message);
};

// ---[ RENDERING CODE ]-------------------------------------------------------

var render = function (canvas, task, data, condition) {
  if (blockRender) {
    return;
  }

  const port = $("#canvas-scroller")[0];
  const maxForecastMode = Math.max(
    ...task.forecastMode.split("+").map((x) => parseInt(x))
  );
  var ctx = canvas.getContext("2d");
  var N = data.values.length;
  var N_endOfTask = data.endOfTask ? N - maxForecastMode + 1 : N;
  // Define affine transformations from sequence coordinates
  // (index, value) to canvas client coordinates (x, y).
  var indexToX = function (index) {
    return index * 35;
  };
  var valueToY = function (value) {
    return 0.5 * canvas.height * (1 - (value - data.yCenter) / data.yRange);
  };
  var transform = function (index, value) {
    return { x: indexToX(index), y: valueToY(value) };
  };

  // Define inverse affine transformations from canvas client
  // coordinates (x, y) to sequence coordinates (index, value).
  var yToValue = function (y) {
    return -data.yRange * ((2 * y) / canvas.height - 1) + data.yCenter;
  };

  // Set the canvas width to the required value.
  canvas.width = indexToX(N_endOfTask + data.predictions.length + (data.animateN || 0));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render the prediction bands and labels.
  ctx.font = "bold 10pt sans-serif";
  ctx.textAlign = "center";
  var predictionBands = [];
  for (var i = 0; i < data.predictions.length; ++i) {
    var p = data.predictions[i];
    if (p.enabled && !data.endOfTask) {
      var L = indexToX(N + (data.animateN || 0) + i - 0.4);
      var R = indexToX(N + (data.animateN || 0) + i + 0.4);
      predictionBands.push({
        color: p.color,
        left: L,
        right: R,
        center: (L + R) / 2,
        width: R - L,
        p: p,
      });
    }
  }
  for (var i = 0; i < predictionBands.length; ++i) {
    var band = predictionBands[i];
    ctx.fillStyle = band.color;
    ctx.fillRect(band.left, 0, band.width, canvas.height);
  }

  // Render the prediction band labels.
  ctx.fillStyle = "#000000";
  ctx.font = "bold 8pt sans-serif";
  if (!data.endOfTask) {
    ctx.fillText(
      "PREDICTION",
      0.5 *
        (predictionBands[predictionBands.length - 1].center +
          predictionBands[0].center),
      15
    );
  }
  ctx.font = "bold 9pt sans-serif";
  for (var i = 0; i < predictionBands.length; ++i) {
    var band = predictionBands[i];
    ctx.fillText(band.p.label, band.center, 33);
  }

  // Draw dotted lines through the points in the sequence.
  if (N > 1) {
    var point = transform(0, data.values[0]);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = "#808080";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    for (var i = 1; i < N; ++i) {
      point = transform(i, data.values[i]);
      ctx.lineTo(point.x, point.y);
    }
    if (data.newValue) {
      point = transform(N, data.newValue);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // If a new value is pending, draw a red error bar line between
  // the predicted value and the new value.
  if (
    data.newValue != null &&
    (data.predictions[0].active != null || data.predictions[0].last != null)
  ) {
    var mn = data.newValue;
    var mx = data.newValue;

    if (data.predictions[0].active != null) {
      if (data.predictions[0].active < mn) mn = data.predictions[0].active;
      if (data.predictions[0].active > mx) mx = data.predictions[0].active;
    }
    if (data.predictions[0].last != null && task.showGrayDots) {
      if (data.predictions[0].last < mn) mn = data.predictions[0].last;
      if (data.predictions[0].last > mx) mx = data.predictions[0].last;
    }

    ctx.lineWidth = 4;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#ff8080";
    ctx.beginPath();
    var point = transform(N, mn);
    ctx.moveTo(point.x, point.y);
    point = transform(N, mx);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
  }

  // If is end of task, show a red errror bar between predicted values and the new values
  if (data.endOfTask) {
    for (var i = 0; i < data.predictions.length; ++i) {
      var mn = data.values[data.values.length - maxForecastMode + i];
      var mx = data.values[data.values.length - maxForecastMode + i];

      if (data.predictions[i].active != null) {
        if (data.predictions[i].active < mn) mn = data.predictions[i].active;
        if (data.predictions[i].active > mx) mx = data.predictions[i].active;
      }
      if (data.predictions[i].last != null && task.showGrayDots) {
        if (data.predictions[i].last < mn) mn = data.predictions[i].last;
        if (data.predictions[i].last > mx) mx = data.predictions[i].last;
      }

      ctx.lineWidth = 4;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#ff8080";
      ctx.beginPath();
      var point = transform(N - maxForecastMode + i, mn);
      ctx.moveTo(point.x, point.y);
      point = transform(N - maxForecastMode + i, mx);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    }

  }

  if (task.showGrayDots && !data.endOfTask) {
    // Draw the last predictions.
    for (var i = 0; i < data.predictions.length; ++i) {
      var p = data.predictions[i];
      if (p.last != null) {
        var point = transform(N + i, p.last);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#c0c0c0";
        ctx.strokeStyle = "#808080";
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // Draw circles at each sequence point. Highlight the point in
  // a different color if it is near the current mouse position.
  ctx.font = "bold 8pt sans-serif";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000000";
  ctx.textAlign = "center";

  for (var i = 0; i < N; ++i) {
    var point = transform(i, data.values[i]);
    var nearMouse = isNearMouse(data.mousePosition, point);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);

    if (task.clickt && i == N - 1) data.clicktpoint = [point.x, point.y];
    if (task.clickt10 && i == N - 11) data.clickt10point = [point.x, point.y];

    ctx.fillStyle = getPointColor(data.values, i, nearMouse, task, condition).fill;

    ctx.strokeStyle = getPointColor(data.values, i, nearMouse, task, condition).stroke;

    ctx.fill();
    ctx.stroke();

    // If this is one of the last 2000 sequence points, OR if the
    // mouse is near it, display the numerical value as text.
    if (nearMouse || i + 2000 >= N) {
      ctx.fillStyle = "#404040";
      // Calculate the "discrete derivative" of the sequence at
      // this point to decide whether to render the text above or
      // below the point.
      var slopeBefore = i === 0 ? 0 : data.values[i] - data.values[i - 1];
      var slopeAfter = i === N - 1 ? 0 : data.values[i + 1] - data.values[i];
      var drawAbove = slopeAfter < slopeBefore;
      if (i + 2000 < N) drawAbove = true;
      ctx.fillText(
        data.roundY(data.values[i]),
        point.x,
        point.y + (drawAbove ? -10 : 17)
      );
    }
  }
  for (var i = 0; i < data.predictions.length; ++i) {
    var p = data.predictions[i];
    if (p.active == null) continue;
    var point = transform(N_endOfTask + i - (data.endOfTask === true ? 1 : 0) , p.active);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#ffff00";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#404040";
    ctx.fillText(data.roundY(p.active), point.x, point.y - 10);
  }

  for (var i = 0; i < data.predictions.length; ++i) {
    var p = data.predictions[i];
    if (p.last == null || !data.endOfTask || !task.showGrayDots) continue;
    var point = transform(
      N_endOfTask + i - 1,
      p.last
    );
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#c0c0c0";
    ctx.strokeStyle = "#808080";
    ctx.fill();
    ctx.stroke();
  }

  // Yellow dot after clicking a point and "Make prediction"
  if (data.newValue !== null) {
    var point = transform(N, data.newValue);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#00ff00";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#404040";
    ctx.fillText(data.roundY(data.newValue), point.x, point.y - 10);
  }

  // If the mouse is over the canvas, render a candidate point at
  // the mouse position along with its numerical value text.
  if (!data.endOfTask && data.mousePosition && data.animateN === null) {
    for (var i = 0; i < predictionBands.length; ++i) {
      var band = predictionBands[i];
      if (
        data.mousePosition.x >= band.left &&
        data.mousePosition.x <= band.right
      ) {
        var value = yToValue(data.mousePosition.y);
        band.p.pending = value;
        var x = band.center;
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(x, data.mousePosition.y, 4, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.fillText(data.roundY(value), x, data.mousePosition.y - 10);
      } else {
        band.p.pending = null;
      }
    }
  }

  if (task.colorDecay === 1) {
    ctx.globalCompositeOperation = "source-atop";
    fadeRecent(canvas, ctx, port);
  }

  if (task.colorDecay === 2) {
    ctx.globalCompositeOperation = "source-atop";
    fadeRecentReverse(canvas, ctx, port);
  }

  if (task.fadeDistant) {
    ctx.globalCompositeOperation = "source-atop";
    fadeDistant(canvas, ctx, port);
  }
  
  ctx.globalCompositeOperation = 'destination-over';
  // Render the horizontal grid lines.
  for (var z = 0; true; z += data.yTick) {
    var py = valueToY(z);
    var ny = valueToY(-z);
    if (py < 0 && ny > canvas.height) break;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e0e0e0";
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, ny);
    ctx.lineTo(canvas.width, ny);
    ctx.stroke();
  }
  
  if (task.showMean) {
    var mean = valueToY(task.mu);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ff0000";
    ctx.beginPath();
    ctx.moveTo(0, mean);
    ctx.lineTo(canvas.width, mean);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
};

// ---[ AR(1) MODEL FUNCTIONS ]------------------------------------------------

var normallyDistributedRandom = function (mean, sigma) {
  var U = Math.random();
  var V = Math.random();
  // Box-Muller transform (basic form) to generate normally-distributed
  // random numbers from a PRNG with uniform distribution in [0, 1)
  return mean + sigma * Math.sqrt(-2 * Math.log(U)) * Math.cos(2 * Math.PI * V);
};

var getNextRealization = function (values, rho, sigma, mu) {
  var last = values.length === 0 ? 0 : values[values.length - 1];
  var epsilon = normallyDistributedRandom(0, sigma);
  return mu + rho * last + epsilon;
};

// ---[ ANIMATION UTILITY FUNCTIONS ]------------------------------------------

var animate = function (duration, smoothness, frameFunc, finalFunc) {
  var animating = true;
  var timebase = null;
  var animator = function (timestamp) {
    if (!animating) return;
    var dt = timebase ? timestamp - timebase : 0;
    if (!timebase) timebase = timestamp;
    var f = 1 / (1 + Math.exp(-smoothness * (dt - duration * 0.5)));
    frameFunc(f);
    window.requestAnimationFrame(animator);
  };
  window.requestAnimationFrame(animator);
  window.setTimeout(function () {
    animating = false;
    frameFunc(1);
    if (finalFunc) finalFunc();
  }, duration);
};

// ---[ INITIALIZATION AND STARTUP ]-------------------------------------------

function setupTask(task, basePayment, condition) {
  const data = {};
  data.values = []; // Fully realized values
  data.newValue = null; // Newly generated val (for anim)
  data.mousePosition = null; // Current mouse position on plot
  data.yCenter = 0; // Vertical center value on plot
  data.yRange = 200; // Vertical scale of plot
  data.yMin = 0; // Minimum known y value
  data.yMax = 0; // Maximum known y value
  data.yTick = 0; // Y axis tick mark spacing
  data.roundY = null; // Smart display rounding function
  data.score = 0; // Current total score.
  data.predhist = []; // Prediction history for submit.
  data.longRunningAveragePredHist = []; // Long-running average prediction history.
  data.longRunningAveragePredTimingHist = []; // Long-running average prediction time history.
  data.longRunningAveragePredLastTime = null;
  data.round = 1; // Current round number.
  data.validationSurvey = null;
  data.endOfTask = false;
  data.animateN = null; // Animated advancement to next value (0-1)

  console.log("RHo is :" + task.rho);

  var predictionDescription;
  if (task.forecastMode === "1+2") {
    data.predictions = [
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#d0dcf4",
        label: "t+1",
      },
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#f4d0d0",
        label: "t+2",
      },
    ];
    predictionDescription = "next two values of the process";
  } else if (task.forecastMode === "1") {
    data.predictions = [
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#d0dcf4",
        label: "t+1",
      },
    ];
    predictionDescription = "next value of the process";
  } else if (task.forecastMode === "2") {
    data.predictions = [
      { enabled: false, active: null, pending: null, when: null, last: null },
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#f4d0d0",
        label: "t+2",
      },
    ];
    predictionDescription =
      "t+2 value of the process, i.e. 2 periods ahead of the current realization";
  } else if (task.forecastMode === "1+10") {
    data.predictions = [
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#f4d0d0",
        label: "t+1",
      },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#d0dcf4",
        label: "t+10",
      },
    ];
    predictionDescription =
      "the value of the process in 1 period and in 10 periods ahead of the last realized value. ";
  } else if (task.forecastMode === "10") {
    data.predictions = [
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#d0dcf4",
        label: "t+10",
      },
    ];
    predictionDescription =
      "the value of the process 10 periods ahead of the last realized value. ";
  } else if (task.forecastMode === "1+5") {
    data.predictions = [
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#d0dcf4",
        label: "t+1",
      },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      { enabled: false, active: null, pending: null, when: null, last: null },
      {
        enabled: true,
        active: null,
        pending: null,
        when: null,
        last: null,
        color: "#f4d0d0",
        label: "t+5",
      },
    ];
    predictionDescription =
      "t+1 and t+5 values of the process, i.e. 1 period and 5 periods ahead of the current realization";
  } else {
    throw "error: invalid forecast mode: " + task.forecastMode;
  }

  if (task.seed) {
    task.seed = task.seed.trim();
    if (task.seed !== "") Math.seedrandom(task.seed);
  }

  var predictionCount = 0;
  for (var i = 0; i < data.predictions.length; ++i) {
    if (data.predictions[i].enabled) ++predictionCount;
  }

  $("#process-info").text(task.processInfo);
  $(".insert-base-payment").text(basePayment.toFixed(2));
  $(".insert-sigma").text(task.sigma);
  $(".insert-bonus-divisor").text(task.bonusDivisor);
  $(".insert-total-rounds").text(task.trainingRounds + task.testingRounds);
  $(".insert-training-rounds").text(task.trainingRounds);
  $(".insert-testing-rounds").text(task.testingRounds);
  $(".insert-prediction-count").text(
    predictionCount + " prediction" + (predictionCount == 1 ? "" : "s")
  );
  $(".insert-estimated-time").text(predictionCount == 1 ? "15" : "20");
  $(".insert-estimated-bonus").text(predictionCount == 1 ? "1.25" : "2.50");
  $(".insert-prediction-next-values").text(predictionDescription);


  if (task.showMean) {
    $(".insert-physical-features").html(
      "<b>We will also show a red horizontal line which indicates the average value of the process.</b>"
    );
  }

  if (task.clickt) {
    $(".insert-prediction-description").html(
      "<b>Before you make your predictions each round, we will ask you to click on the most recent realization of the process. For convenience, it will be highlighted in blue.</b>"
    );
  }

  if (task.clickt10) {
    $(".insert-prediction-description").html(
      "<b>Before you make your predictions in each round, we will ask you to click on the realization of the process that occurred 10 periods before the current realization. For convenience, it will be highlighted in blue.</b>"
    );
  }

  if (task.context) {
    $(".insert-context").text(
      "The process you will see has the same property as " +
        task.context +
        " in the last three decades."
    );
  }

  if (task.entryMode === "numeric") {
    for (var i = 0; i < data.predictions.length; ++i) {
      var p = data.predictions[i];
      if (!p.enabled) continue;
      if (i > 0) $("#numeric-entry").append("&nbsp; &nbsp;");
      $("#numeric-entry").append(
        "Prediction " +
          p.label +
          ': <input type="number" id="prediction-box-' +
          i +
          '" placeholder="Value">'
      );
      $("#prediction-box-" + i).on("input", function () {
        p.when = new Date().getTime();
      });
    }
  }

  if (task.clickt) {
    data.clickedt = false;
    data.clicktpoint = [0, 0];
  }
  if (task.clickt10) {
    data.clickedt10 = false;
    data.clickt10point = [0, 0];
  }

  for (var i = 0; i < 40; ++i) {
    var y = getNextRealization(data.values, task.rho, task.sigma, task.mu);
    if (y < data.yMin) data.yMin = y;
    if (y > data.yMax) data.yMax = y;
    data.values.push(y);
  }

  condition !== "S7"
    ? (data.yCenter = data.values[data.values.length - 1])
    : (data.yCenter = task.mu);
  data.yRange = (data.yMax - data.yMin) * 1.5;

  if (data.yRange < 10) data.yTick = 1;
  else if (data.yRange < 50) data.yTick = 5;
  else if (data.yRange < 100) data.yTick = 10;
  else if (data.yRange < 500) data.yTick = 50;
  else data.yTick = 100;

  if (data.yRange < 10)
    data.roundY = function (x) {
      return Number(x).toFixed(2);
    };
  else if (data.yRange < 100)
    data.roundY = function (x) {
      return Number(x).toFixed(1);
    };
  else
    data.roundY = function (x) {
      return Math.round(x);
    };

  if (task.entryMode === "numeric") {
    $("#numeric-entry").hide();
  } else {
    $("#numeric-entry").hide();
  }

  return data;
}

function showConsent() {
  $(".page").hide();
  $("#consent-page").show();
}

export var launchExperiment = async function (
  tasks,
  basePayment,
  isPreview = false,
  skipIntro = false,
  condition = ""
) {
  hitData.initTime = new Date().getTime();
  const port = $("#canvas-scroller")[0];
  $("#survey-page").addClass("condition-" + condition);
  $("#survey-page").addClass("condition-group-" + condition[0]);
  $("#final-page").addClass("condition-" + condition);
  $("#final-page").addClass("condition-group-" + condition[0]);
  const canvas = $("canvas")[0];

  let data, task;
  let currentTask = 0;

  function startTaskRun() {
    blockRender = false;
    resetScroll(port);
    window.setTimeout(() => {

      scrollToEnd();
    }, 500);
    $("#between-task-page").addClass("hide");
    $("#experiment-page").clearQueue().fadeTo(500, 1);
    render(canvas, task, data, condition);
  }

  function isLastRound() {
    return isLastRoundFn(data, task);
  }

  function shouldEndExperiment() {
    return isLastRound() && currentTask >= tasks.length;
  }

  function shouldStartNextTask() {
    return !shouldEndExperiment() && isLastRound();
  }

  function populateConsent () {
    $("#consent-page").prepend(consent(tasks, basePayment, condition));
  }

  function populateInstructions () {
    $("#instruction-page").prepend(instructions(tasks, basePayment, condition))
  }

  function startNextTask() {
    blockRender = true;
    task = tasks[currentTask];
    data = setupTask(task, basePayment, condition);

    hitData.accumulated = [...hitData.accumulated, data];
    startNextRound();
    if (tasks.length > 1) {
      showBetweenTaskMessage(condition, currentTask, 0.5);
    }  else {
      transitionBetweenTask(currentTask, 0.5);
      startTaskRun();
    }
    currentTask += 1;
  }

  function updateRoundInfo () {
    $("#mode-text").text(
      data.round <= task.trainingRounds ? "Training Phase" : "Testing Phase"
    );
    $("#round-number").text(data.round);
    $("#score-value").text(
      hitData.accumulated
        .map((d) => Math.round(d.score))
        .reduce((a, b) => a + b, 0)
    );
  }

  function startNextRound() {
    $("#long-running-task-prediction input").val("");
    if (task.predictLongRunning) {
      $("#experiment-page").addClass("predict-long-running");
    } else {
      $("#experiment-page").removeClass("predict-long-running");
    }
    updateRoundInfo();
  }


  function scrollToEnd() {
    data.animateN = 0;
    var finalScroll = canvas.width - port.clientWidth;
    animate(
      2000,
      0.01,
      function (f) {
        port.scrollLeft = Math.round(finalScroll * f);
      },
      function () {
        data.animateN = null;
        render(canvas, task, data, condition);
      }
    );
    return true;
  }

  populateConsent();
  populateInstructions();
  showConsent();

  $("#consent-button").on("click", function () {
    if (isPreview) {
      window.alert(
        "You are currently previewing this HIT. " +
          "Please accept this HIT before proceeding."
      );
    } else {
      var startingTime = new Date();
      hitData.consentTime = startingTime.getTime();
      $("#consent-page")
        .clearQueue()
        .fadeOut(500);

      $("#instruction-page")
        .clearQueue()
        .fadeIn(500, function () {
          if (skipIntro) $("#start-button").trigger("click");
        });
    }
  });


  $("#start-button").click(function () {
    if (hitData.startTime) {
      return;
    }

    hitData.startTime = new Date().getTime();

    
    if (shouldRunAfterInstructionsSurvey(tasks, condition)) {
      hitData.validationSurvey = afterInstructionsSurvey(tasks);

      $("#instruction-page")
        .clearQueue()
        .fadeOut();

      hitData.validationSurvey.$el.fadeIn();
      hitData.validationSurvey.$el.one('submit', function () {
        console.log(hitData.validationSurvey.isCorrect(), hitData.validationSurvey.value())
        console.log('submit');
        hitData.startTime = new Date().getTime();
        hitData.validationSurvey.$el.clearQueue().fadeOut(500, function () {
          startNextTask();
          data.validationSurvey = hitData.validationSurvey.isCorrect();
        });
      });
    } else {
      hitData.startTime = new Date().getTime();
      $("#instruction-page")
        .clearQueue()
        .fadeOut(500, function () {
          startNextTask();
        });
    }
  });

  $("canvas").mousemove(function (e) {
    if (task.entryMode === "numeric") return;
    var rect = canvas.getBoundingClientRect();
    data.mousePosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    render(canvas, task, data, condition);
  });

  $("canvas").on("click", function () {
    if (data.animateN !== null) return;

    if (task.clickt10) {
      if (!data.clickedt10) {
        //Checking whether the click is on the blue dot or not for S5_b
        data.clickedt10 = isNearMouse(data.mousePosition, {
          x: data.clickt10point[0],
          y: data.clickt10point[1],
        });
      }
    } else if (task.clickt && condition !== "S6") {
      if (!data.clickedt) {
        data.clickedt = isNearMouse(data.mousePosition, {
          x: data.clickedt[0],
          y: data.clickedt[1],
        });
      }
    }

    for (var i = 0; i < data.predictions.length; ++i) {
      var p = data.predictions[i];
      //If the click on the canvas was on the predictions panel
      if (p.enabled && p.pending !== null) {
        //If the blue dots had not being clicked we don't allow the prediction pick
        if (task.clickt10) {
          if (!data.clickedt10) {
            alert("Please click on blue dot (t-10) before making predictions");
            return;
          }
        } else if (task.clickt && condition !== "S6") {
          if (!data.clickedt) {
            alert(
              "Please click on the blue dot (t-1) before making predictions"
            );
            return;
          }
        }
        //else
        p.active = p.pending;
        p.pending = null;
        p.when = new Date().getTime();
      }
    }
    render(canvas, task, data, condition);
  });

  $("canvas").mouseleave(function () {
    if (task.entryMode === "numeric") return;
    if (data.animateN !== null) return;
    for (var i = 0; i < data.predictions.length; ++i)
      data.predictions[i].pending = null;
    data.mousePosition = null;
    render(canvas, task, data, condition);
  });

  $("#long-running-task-prediction input").change(() => {
    data.longRunningAveragePredLastTime = new Date().getTime();
  });

  $("#prediction-button").click(function () {
    if (data.animateN !== null) return;

    if (task.entryMode === "numeric") {
      var firstCtrl = null;
      for (var i = 0; i < data.predictions.length; ++i) {
        var p = data.predictions[i];
        if (!p.enabled) continue;
        var ctrl = $("#prediction-box-" + i);
        if (!firstCtrl) firstCtrl = ctrl;
        var str = ctrl.val();
        if (str == null || str.trim() === "" || isNaN(Number(str))) {
          window.alert(
            "Please make predictions " + "by entering values in the text boxes."
          );
          return;
        }
        p.active = Number(str);
        ctrl.val("");
      }

      firstCtrl.focus();
    } else {
      for (var i = 0; i < data.predictions.length; ++i) {
        var p = data.predictions[i];
        if (p.enabled && p.active == null) {
          window.alert(
            "Please make predictions " +
              "in each column at the right of the graph."
          );
          return;
        }
      }
    }

    if (task.predictLongRunning) {
      const val = $("#long-running-task-prediction input").val();
      const longRunningPrediction = parseFloat(val);
      if (isNaN(longRunningPrediction)) {
        alert("Please enter a valid number in the long-run average text field.");
        return;
      }
      data.score += scoreForPrediction(task, longRunningPrediction, 0);
      console.log('adding to score',  scoreForPrediction(task, longRunningPrediction, 0), data.score);
      data.longRunningAveragePredHist.push(longRunningPrediction);
      data.longRunningAveragePredTimingHist.push(data.longRunningAveragePredLastTime);
      data.longRunningAveragePredLastTime = null;
    } else {
      data.longRunningAveragePredHist.push(null);
      data.longRunningAveragePredTimingHist.push(null);
    }

    

    var predhistEntry = { when: new Date().getTime() };
    if (task.forecastMode === "1+2") {
      predhistEntry.first = data.roundY(data.predictions[0].active);
      predhistEntry.second = data.roundY(data.predictions[1].active);
      predhistEntry.when1 = data.predictions[0].when;
      predhistEntry.when2 = data.predictions[1].when;
    } else if (task.forecastMode === "1+5") {
      predhistEntry.first = data.roundY(data.predictions[0].active);
      predhistEntry.second = data.roundY(data.predictions[4].active);
      predhistEntry.when1 = data.predictions[0].when;
      predhistEntry.when2 = data.predictions[4].when;
    } else if (task.forecastMode === "1") {
      predhistEntry.first = data.roundY(data.predictions[0].active);
      predhistEntry.second = -999999;
      predhistEntry.when1 = data.predictions[0].when;
      predhistEntry.when2 = null;
    } else if (task.forecastMode === "2") {
      predhistEntry.first = -999999;
      predhistEntry.second = data.roundY(data.predictions[1].active);
      predhistEntry.when1 = null;
      predhistEntry.when2 = data.predictions[1].when;
    } else if (task.forecastMode === "1+10") {
      predhistEntry.first = data.roundY(data.predictions[0].active);
      predhistEntry.second = data.roundY(data.predictions[9].active);
      predhistEntry.when1 = data.predictions[0].when;
      predhistEntry.when2 = data.predictions[9].when;
    } else if (task.forecastMode === "10") {
      predhistEntry.first = data.roundY(data.predictions[9].active);
      predhistEntry.second = -999999;
      predhistEntry.when1 = data.predictions[9].when;
      predhistEntry.when2 = null;
    }

    data.predhist.push(predhistEntry);

    for (var i = 0; i < data.predictions.length; ++i)
      data.predictions[i].when = null;
    data.round = data.round + 1;
    data.clickedt = false;
    data.clickedt10 = false;


    data.animateN = 0;
    render(canvas, task, data, condition);
    port.scrollLeft = canvas.width - port.clientWidth;

    $("#long-running-task-prediction input").val("");

    if (shouldStartNextTask() || shouldEndExperiment()) {
      data.endOfTask = true;
      generateFutureRealizations(data, task);
      render(canvas, task, data, condition);

      window.setTimeout(() => {
        if (shouldEndExperiment()) {
          hasExperimentEnded = true;
          $("#experiment-page").fadeOut(500, function () {
            $("#survey-page").clearQueue().fadeIn(500);
            hitData.surveyTime = new Date().getTime();
          });
        } else {
          startNextTask();
        }
      }, 3000);
    } else {
      data.newValue = getNextRealization(
        data.values,
        task.rho,
        task.sigma,
        task.mu
      );
      var oldCenter = data.yCenter;
      var newCenter = data.newValue;
       var scores = [];
       if (data.predictions[0].active != null) {
         scores.push(
           Math.round(
             scoreForPrediction(task, data.predictions[0].active, data.newValue)
           )
         );
        }
       if (data.predictions[0].last != null) {
         scores.push(
           Math.round(
             scoreForPrediction(task, data.predictions[0].last, data.newValue)
           )
         );
        }

       var h = $("#score-history");
       var oh = $("#score-outer-bar");
       var st = $("#score-text");

       var scoreStr = " (";
       for (var i = 0; i < scores.length; ++i) {
         data.score += scores[i];
         var cl = i == 0 ? "p1b" : "p2b";
         if (i > 0) scoreStr += ", ";
         scoreStr += '<span class="' + cl + '">+' + scores[i] + "</span>";
       }
       scoreStr += ")";

       updateRoundInfo();
       if (scoreStr !== " ()") {
         h.append(scoreStr);
         animate(
           500,
           0.01,
           function (f) {
             var x = Math.floor(Math.round(f * 256));
             if (x < 0) x = 0;
             else if (x > 255) x = 255;
             var ix = 255 - x;
             var hex = "0123456789abcdef";
             var code = hex[x >> 4] + hex[x & 0xf];
             var str = "#" + code + "ff" + code;
             var str2 = "rgba(" + x + ",255," + x + ",0.85)";
             oh.css("backgroundColor", str);
             st.css("backgroundColor", str2);
           },
           function () {
             oh.css("backgroundColor", "#ffffff");
             st.css("backgroundColor", "rgba(255,255,255,0.85)");
           }
         );
       }

       if (data.round === task.trainingRounds + 1) {
         for (var i = 0; i < data.predictions.length; ++i) {
           data.predictions[i].last = null;
           data.predictions[i].active = null;
         }
         data.score = 0;
         h.text("");
       }

       if (task.trainingRounds > 0 && data.round === task.trainingRounds + 1) {
         var overlay = $("<div>")
           .text("Testing Session Starts!")
           .css({
             position: "fixed",
             width: "200px",
             height: "50px",
             left: port.clientWidth / 2 - 100 + port.offsetLeft + "px",
             top: port.clientHeight / 2 - 25 + port.offsetTop + "px",
             border: "1px solid black",
             backgroundColor: "red",
             color: "black",
             textAlign: "center",
             lineHeight: "50px",
             fontWeight: "bold",
           })
           .appendTo(port)
           .hide();
         overlay.fadeIn(500, function () {
           window.setTimeout(function () {
             overlay.fadeOut(500, function () {
               overlay.remove();
             });
           }, 2000);
         });
       }

      window.setTimeout(function () {
        animate(
          1000,
          0.01,
          function (f) {
            data.animateN = f;
            condition !== "S7"
              ? (data.yCenter = (1 - f) * oldCenter + f * newCenter)
              : (data.yCenter = task.mu);
            render(canvas, task, data, condition);
            port.scrollLeft = canvas.width - port.clientWidth;
          },
          function () {
            data.animateN = null;
            console.log("push", data.newValue);
            data.values.push(data.newValue);
            for (var i = 1; i < data.predictions.length; ++i) {
              if (data.predictions[i].enabled)
                data.predictions[i - 1].last = data.predictions[i].active;
              else data.predictions[i - 1].last = data.predictions[i].last;
            }
            for (var i = 0; i < data.predictions.length; ++i) {
              data.predictions[i].active = null;
              data.predictions[i].pending = null;
            }
            condition !== "S7"
              ? (data.yCenter = data.newValue)
              : (data.yCenter = task.mu);
            data.newValue = null;

            port.scrollLeft = canvas.width - port.clientWidth;
            startNextRound();
            render(canvas, task, data, condition);
          }
        );
      }, 500);
    }
  });


  $("#between-task-page button").click(function () {
    if (shouldRunBeforeTaskSurvey(currentTask - 1, condition)) {

      hitData.validationSurvey = beforeTaskSurvey(currentTask - 1, condition);
      $("#between-task-page").addClass("hide");

      hitData.validationSurvey.$el.fadeIn();
      hitData.validationSurvey.$el.one('submit', function () {
        data.validationSurvey = hitData.validationSurvey?.isCorrect() ?? null;
        hitData.validationSurvey.$el.clearQueue().fadeOut(500, () => {
          startTaskRun();
        });
      });
    } else {
      startTaskRun();
    }
  });

  $("#submit-button").click(function () {
    var d = createResults(hitData, tasks);
    var missing = false;

    var sd = {};

    $("#survey-page .survey-data").each(function (i, el) {
      var value = el.value;
      var optional = $(el).hasClass("optional");
      if (
        !optional &&
        el.scrollHeight !== 0 &&
        (value == null || value.trim() === "" || value.trim() === "xxx")
        ) {
          missing = true;
          return;
        } else {
          if (el.scrollHeight !== 0) {
            sd[el.name] = value.trim();
          }
      }
    });

    if (missing) {
      window.alert(
        "Please answer all survey questions and " +
          "then click the Submit Results button."
      );
      return;
    }

    if (Number(sd.age) < 18 || Number(sd.age) > 100) {
      window.alert(
        "The age you entered is out of range. Please " +
          "enter an age between 18 and 100."
      );
      return;
    }

    Object.keys(sd).forEach(function (v) {
      hitData.surveyData.push(v + "=" + sd[v]);
    })

    

    $(".insert-score-bonus").css("display", "none");
    $(".insert-total-bonus-payment").text(totalBonus(d, tasks).toFixed(2));

    if (d.score.length === 1) {
      $(".insert-score-bonus").css("display", "block");
      $(".insert-score-bonus .insert-final-score").text(d.score[0].toFixed(2));
      $(".insert-score-bonus .insert-final-bonus").text(
        calculateBonus(d.score[0], tasks[0]).toFixed(2)
      );
    } else {
      d.score.forEach(function (score, i) {
        $(".insert-score-bonus-" + i)
          .css('display', 'block');
        $(".insert-score-bonus-" + i).
          find(".insert-final-score")
          .text(score.toFixed(2));
        $(".insert-score-bonus-" + i)
          .find(".insert-final-bonus")
          .text(calculateBonus(score, tasks[i]).toFixed(2));
      });
    }

    



    $("#survey-page")
      .clearQueue()
      .fadeOut(500, function () {
        $("#final-page").clearQueue().fadeIn(500);
      });
  });

  const clickFinalButton = new Promise((resolve) => {
    $(".final-button").click(function () {

      let missing = false;

      $("#final-page .survey-data").each(function (i, el) {
        var value = el.value;
        var optional = $(el).hasClass("optional");
        if (
          !optional &&
          el.scrollHeight !== 0 &&
          (value == null || value.trim() === "" || value.trim() === "xxx")
        ) {
          missing = true
        } else {
          if (el.scrollHeight !== 0) {
            hitData.surveyData.push(el.name + "=" + value.trim());
          }
        }
      });

      if (missing) {
        window.alert(
          "Please enter an email and " +
            "then click the Submit button."
        );
        return;
      }

      var d = createResults(hitData, tasks);

      resolve(d);
    });

    /* if (E.offline) {
      console.log(JSON.stringify(d));
      window.alert(
        "Offline mode; data will not be saved (see " +
          "console for data that would be saved)"
      );
      return;
    } */
  });

  //render(canvas, task, data);
  if (skipIntro) $("#consent-button").trigger("click");

  return clickFinalButton;
};
