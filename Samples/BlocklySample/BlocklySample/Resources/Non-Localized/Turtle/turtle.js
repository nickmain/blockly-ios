/*
 *  Copyright 2016 Google Inc. All Rights Reserved.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * @fileoverview Javascript for the Turtle Blockly demo on Android.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

/**
 * Create a namespace for the application.
 */
var Turtle = {};

Turtle.DEFAULT_WIDTH = 400;
Turtle.DEFAULT_HEIGHT = 400;
Turtle.WIDTH = Turtle.DEFAULT_WIDTH;
Turtle.HEIGHT = Turtle.DEFAULT_HEIGHT;

/**
 * PID of animation task currently executing.
 */
Turtle.pid = 0;

/**
 * Specifies whether the turtle should cancel execution on the next loop.
 */
Turtle.cancelled = false;

/**
 * Should the turtle be drawn?
 */
Turtle.visible = true;

/**
 * Initialize Blockly and the turtle.  Called on page load.
 */
Turtle.init = function() {
  var visualization = document.getElementById('visualization');
  // Add to reserved word list: API, local variables in execution evironment
  // (execute) and the infinite loop detection function.
  //Blockly.JavaScript.addReservedWords('Turtle,code');

  Turtle.ctxDisplay = document.getElementById('display').getContext('2d');
  Turtle.ctxScratch = document.getElementById('scratch').getContext('2d');
  Turtle.reset();
};

window.addEventListener('load', Turtle.init);

/**
 * Sets the starting bounds (width and height) for the turtle's canvas, and resets the canvas.
 */
Turtle.setBounds = function(width, height) {
  Turtle.DEFAULT_WIDTH = width;
  Turtle.DEFAULT_HEIGHT = height;
  Turtle.reset();
}

/**
 * Reset the turtle to the start position, clear the display, and kill any
 * pending tasks.
 */
Turtle.reset = function() {
  Turtle._unhighlightLastBlock()

  // Starting location and heading of the turtle and canvas.
  Turtle.WIDTH = Turtle.DEFAULT_WIDTH;
  Turtle.HEIGHT = Turtle.DEFAULT_HEIGHT;
  Turtle.x = Turtle.WIDTH / 2;
  Turtle.y = Turtle.HEIGHT / 2;

  Turtle.heading = 0;
  Turtle.penDownValue = true;
  Turtle.visible = true;

  // Clear the display.
  Turtle.ctxScratch.canvas.width = Turtle.WIDTH;
  Turtle.ctxScratch.canvas.height = Turtle.HEIGHT;
  Turtle.ctxDisplay.canvas.width = Turtle.WIDTH;
  Turtle.ctxDisplay.canvas.height = Turtle.HEIGHT;
  Turtle.ctxScratch.strokeStyle = '#000000';
  Turtle.ctxScratch.fillStyle = '#000000';
  Turtle.ctxScratch.lineWidth = 1;
  Turtle.ctxScratch.lineCap = 'round';
  Turtle.ctxScratch.font = 'normal 18pt Arial';
  Turtle.display();

  // Kill any task.
  if (Turtle.pid) {
    window.clearTimeout(Turtle.pid);
  }
  Turtle.pid = 0;

  // Reset the log
  Turtle.log = []

  Turtle.cancelled = false
};

/**
 * Copy the scratch canvas to the display canvas. Add a turtle marker.
 */
Turtle.display = function() {
  Turtle.ctxDisplay.globalCompositeOperation = 'copy';
  Turtle.ctxDisplay.drawImage(Turtle.ctxScratch.canvas, 0, 0);
  Turtle.ctxDisplay.globalCompositeOperation = 'source-over';
  // Draw the turtle.
  if (Turtle.visible) {
    // Make the turtle the colour of the pen.
    Turtle.ctxDisplay.strokeStyle = Turtle.ctxScratch.strokeStyle;
    Turtle.ctxDisplay.fillStyle = Turtle.ctxScratch.fillStyle;

    // Draw the turtle body.
    var radius = Turtle.ctxScratch.lineWidth / 2 + 10;
    Turtle.ctxDisplay.beginPath();
    Turtle.ctxDisplay.arc(Turtle.x, Turtle.y, radius, 0, 2 * Math.PI, false);
    Turtle.ctxDisplay.lineWidth = 3;
    Turtle.ctxDisplay.stroke();

    // Draw the turtle head.
    var WIDTH = 0.3;
    var HEAD_TIP = 10;
    var ARROW_TIP = 4;
    var BEND = 6;
    var radians = 2 * Math.PI * Turtle.heading / 360;
    var tipX = Turtle.x + (radius + HEAD_TIP) * Math.sin(radians);
    var tipY = Turtle.y - (radius + HEAD_TIP) * Math.cos(radians);
    radians -= WIDTH;
    var leftX = Turtle.x + (radius + ARROW_TIP) * Math.sin(radians);
    var leftY = Turtle.y - (radius + ARROW_TIP) * Math.cos(radians);
    radians += WIDTH / 2;
    var leftControlX = Turtle.x + (radius + BEND) * Math.sin(radians);
    var leftControlY = Turtle.y - (radius + BEND) * Math.cos(radians);
    radians += WIDTH;
    var rightControlX = Turtle.x + (radius + BEND) * Math.sin(radians);
    var rightControlY = Turtle.y - (radius + BEND) * Math.cos(radians);
    radians += WIDTH / 2;
    var rightX = Turtle.x + (radius + ARROW_TIP) * Math.sin(radians);
    var rightY = Turtle.y - (radius + ARROW_TIP) * Math.cos(radians);
    Turtle.ctxDisplay.beginPath();
    Turtle.ctxDisplay.moveTo(tipX, tipY);
    Turtle.ctxDisplay.lineTo(leftX, leftY);
    Turtle.ctxDisplay.bezierCurveTo(leftControlX, leftControlY,
                                    rightControlX, rightControlY, rightX, rightY);
    Turtle.ctxDisplay.closePath();
    Turtle.ctxDisplay.fill();
  }
};

/**
 * Execute the user's code.  Heaven help us...
 */
Turtle.execute = function(code) {
  // Reset the turtle
  Turtle.reset();
  Turtle.ticks = 1000000;
  /// TODO(#268): Replace Turtle with a version that uses JS Interpreter
  window.LoopTrap = 1000;

  // Tracks the turtle's position, and heading before animating to calculate canvas size.
  Turtle.fakeX = Turtle.WIDTH / 2;
  Turtle.fakeY = Turtle.HEIGHT / 2;
  Turtle.fakeHeading = 0;

  // Gathers the starting position for the turtle after the canvas is scaled.
  Turtle.startingX = Turtle.WIDTH / 2;
  Turtle.startingY = Turtle.HEIGHT / 2;

  try {
    eval(code);
  } catch (e) {
    // Null is thrown for infinite loop.
    // Otherwise, abnormal termination is a user error.
    if (e !== Infinity) {
      // Re-throw it and let the iOS code handle the error
      throw e;
    }
  }

  Turtle._scrollTo(Turtle.startingX - Turtle.DEFAULT_WIDTH / 2,
                   Turtle.startingY - Turtle.DEFAULT_HEIGHT / 2);

  Turtle.x = Turtle.startingX;
  Turtle.y = Turtle.startingY;

  // Turtle.log now contains a transcript of all the user's actions.
  // Animate the transcript.
  Turtle.pid = window.setTimeout(Turtle.animate, 100);
};

/**
 * Iterate through the recorded path and animate the turtle's actions.
 */
Turtle.animate = function() {
  // All tasks should be complete now.  Clean up the PID list.
  Turtle.pid = 0;

  var tuple = Turtle.log.shift();
  if (!tuple || Turtle.cancelled) {
    Turtle._unhighlightLastBlock()
    Turtle._finishExecution()
    return;
  }
  var command = tuple.shift();
  Turtle.step(command, tuple);
  Turtle.display();

  // Scale the speed non-linearly, to give better precision at the fast end.
  var stepSpeed = 1000 * Math.pow(1 - 2, 2);
  Turtle.pid = window.setTimeout(Turtle.animate, stepSpeed);
};

/**
 * Signal to the Turtle that it should stop execution on its next loop.
 */
Turtle.cancel = function() {
  Turtle.cancelled = true;
}

/**
 * Execute one step.
 * @param {string} command Logo-style command (e.g. 'FD' or 'RT').
 * @param {!Array} values List of arguments for the command.
 */
Turtle.step = function(command, values) {
  var blockID = values[values.length - 1].replace("block_id_", "")
  Turtle._unhighlightLastBlock()
  Turtle._highlightBlock(blockID)

  switch (command) {
    case 'FD':  // Forward
      if (Turtle.penDownValue) {
        Turtle.ctxScratch.beginPath();
        Turtle.ctxScratch.moveTo(Turtle.x, Turtle.y);
      }
      var distance = values[0];
      if (distance) {
        Turtle.x += distance * Math.sin(2 * Math.PI * Turtle.heading / 360);
        Turtle.y -= distance * Math.cos(2 * Math.PI * Turtle.heading / 360);
        var bump = 0;
      } else {
        // WebKit (unlike Gecko) draws nothing for a zero-length line.
        var bump = 0.1;
      }
      if (Turtle.penDownValue) {
        Turtle.ctxScratch.lineTo(Turtle.x, Turtle.y + bump);
        Turtle.ctxScratch.stroke();
      }
      break;
    case 'RT':  // Right Turn
      Turtle.heading += values[0];
      Turtle.heading %= 360;
      if (Turtle.heading < 0) {
        Turtle.heading += 360;
      }
      break;
    case 'DP':  // Draw Print
      Turtle.ctxScratch.save();
      Turtle.ctxScratch.translate(Turtle.x, Turtle.y);
      Turtle.ctxScratch.rotate(2 * Math.PI * (Turtle.heading - 90) / 360);
      Turtle.ctxScratch.fillText(values[0], 0, 0);
      Turtle.ctxScratch.restore();
      break;
    case 'DF':  // Draw Font
      Turtle.ctxScratch.font = values[2] + ' ' + values[1] + 'pt ' + values[0];
      break;
    case 'PU':  // Pen Up
      Turtle.penDownValue = false;
      break;
    case 'PD':  // Pen Down
      Turtle.penDownValue = true;
      break;
    case 'PW':  // Pen Width
      Turtle.ctxScratch.lineWidth = values[0];
      break;
    case 'PC':  // Pen Colour
      Turtle.ctxScratch.strokeStyle = values[0];
      Turtle.ctxScratch.fillStyle = values[0];
      break;
    case 'HT':  // Hide Turtle
      Turtle.visible = false;
      break;
    case 'ST':  // Show Turtle
      Turtle.visible = true;
      break;
  }
};

// Canvas measurement

// Fake all of the moves, and resize the canvas so the turtle fits in the canvas when it draws.
// Also track the turtle starting position to keep it in the same place on the larger canvas.
Turtle.measureCanvasMove = function(distance) {
  var xDelta = distance * Math.sin(2 * Math.PI * Turtle.fakeHeading / 360);
  var yDelta = distance * Math.cos(2 * Math.PI * Turtle.fakeHeading / 360);
  Turtle.fakeX += xDelta;
  Turtle.fakeY -= yDelta;
  if (Turtle.fakeX > Turtle.WIDTH || Turtle.fakeX < 0) {
    // The canvas only grows to the right, so if the turtle walks off the left, move it to the
    //  right to compensate.
    if (Turtle.fakeX < 0) {
      Turtle.startingX -= xDelta;
      Turtle.fakeX -= xDelta;
    }
    Turtle.WIDTH = Turtle.WIDTH + Math.abs(xDelta);
    Turtle.ctxScratch.canvas.width = Turtle.WIDTH;
    Turtle.ctxDisplay.canvas.width = Turtle.WIDTH;
  }
  if (Turtle.fakeY > Turtle.HEIGHT || Turtle.fakeY < 0) {
    // The canvas only grows down, so if the turtle walks off the top, move it up to compensate.
    if (Turtle.fakeY < 0) {
      Turtle.startingY += yDelta;
      Turtle.fakeY += yDelta;
    }
    Turtle.HEIGHT = Turtle.HEIGHT + Math.abs(yDelta);
    Turtle.ctxScratch.canvas.height = Turtle.HEIGHT;
    Turtle.ctxDisplay.canvas.height = Turtle.HEIGHT;
  }
}

Turtle.measureCanvasRotation = function(angle) {
  Turtle.fakeHeading += angle;
  Turtle.fakeHeading %= 360;
  if (Turtle.fakeHeading < 0) {
    Turtle.fakeHeading += 360;
  }
}

// Turtle API.

Turtle.moveForward = function(distance, id) {
  Turtle.log.push(['FD', distance, id]);
  Turtle.measureCanvasMove(distance);
};

Turtle.moveBackward = function(distance, id) {
  Turtle.log.push(['FD', -distance, id]);
  Turtle.measureCanvasMove(-distance);
};

Turtle.turnRight = function(angle, id) {
  Turtle.log.push(['RT', angle, id]);
  Turtle.measureCanvasRotation(angle);
};

Turtle.turnLeft = function(angle, id) {
  Turtle.log.push(['RT', -angle, id]);
  Turtle.measureCanvasRotation(-angle);
};

Turtle.penUp = function(id) {
  Turtle.log.push(['PU', id]);
};

Turtle.penDown = function(id) {
  Turtle.log.push(['PD', id]);
};

Turtle.penWidth = function(width, id) {
  Turtle.log.push(['PW', Math.max(width, 0), id]);
};

Turtle.penColour = function(colour, id) {
  Turtle.log.push(['PC', colour, id]);
};

Turtle.hideTurtle = function(id) {
  Turtle.log.push(['HT', id]);
};

Turtle.showTurtle = function(id) {
  Turtle.log.push(['ST', id]);
};

Turtle.drawPrint = function(text, id) {
  Turtle.log.push(['DP', text, id]);
};

Turtle.drawFont = function(font, size, style, id) {
  Turtle.log.push(['DF', font, size, style, id]);
};

Turtle._highlightBlock = function(blockID) {
  // Send callback message to iOS to highlight the block
  window.webkit.messageHandlers.TurtleViewControllerCallback.postMessage(
    { method: "highlightBlock", blockID: blockID });
}

Turtle._unhighlightLastBlock = function() {
  // Send callback message to iOS to unhighlight the last highlighted block
  window.webkit.messageHandlers.TurtleViewControllerCallback.postMessage(
    { method: "unhighlightLastBlock" });
}

Turtle._finishExecution = function() {
  // Send callback message to iOS to finish execution
  window.webkit.messageHandlers.TurtleViewControllerCallback.postMessage(
    { method: "finishExecution" });
}

Turtle._scrollTo = function(x, y) {
  // Send callback message to iOS to center on the turtle
  window.webkit.messageHandlers.TurtleViewControllerCallback.postMessage(
    { method: "scrollTo", x: x, y: y });
}
