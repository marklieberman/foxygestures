/* global angular */
'use strict';

var app = angular.module('mgOptionsApp', [
  'ui.bootstrap'
]);

// -----------------------------------------------------------------------------
app.factory('commands', [
  '$interval',
  function ($interval) {
    var service = [];

    // background/commands.js seems to be loaded asynchronously.
    var promise = $interval(() => {
      if (modules.commands) {
        $interval.cancel(promise);
        angular.copy(modules.commands, service);
      }
    }, 100);

    promise.then(() => {}, () => {
      service.loaded = true;
    });

    // Find a command by ID.
    service.findById = (id) => {
      return service.find(function (cmd) {
        return cmd.id === id;
      });
    };

    return service;
  }]);

// -----------------------------------------------------------------------------
app.factory('settings', [
  '$rootScope',
  '$q',
  'commands',
  function ($rootScope, $q, commands) {
    var service = {
      gestureButton: 2,
      gestureFidelity: 10,
      gestureTimeout: 400,
      drawTrails: true,
      trailColor: 'purple',
      trailWidth: 2,
      mappings: []
    };

    var settingsKeys = Object.keys(service);

    // Load settings from browser storage.
    service.load = () => {
      var deferred = $q.defer();
      browser.storage.local.get(service).then(
        results => {
          $rootScope.$apply(() => {
            settingsKeys.forEach(key => {
              if (results[key]) {
                service[key] = results[key];
              }
            });
            deferred.resolve();
          });
        },
        err => deferred.reject(err));
      return deferred.promise;
    };

    // Save settings to browser storage.
    service.save = () => {
      var deferred = $q.defer();
      browser.storage.local.set(service).then(
        () => deferred.resolve(),
        err => deferred.reject(err));
      return deferred.promise;
    };

    return service;
  }]);

// -----------------------------------------------------------------------------
app.controller('OptionsCtrl', [
  '$scope',
  'commands',
  'settings',
  function ($scope, commands, settings) {
    // Scope variables.
    $scope.commands = commands;
    $scope.settings = settings;
    $scope.controls = {
      gestureTimeout: 0.4
    };

    // Initialize settings on load.
    settings.load().then(() => {
      settings.loaded = true;
      var inSeconds = Math.floor(settings.gestureTimeout / 100) / 10;
      $scope.controls.gestureTimeout = inSeconds;
      $scope.$broadcast('redraw');
    });

    // Persist settings on change.
    $scope.$watch('settings', (newValue) => {
      if (newValue) {
        settings.save().then(() => {
          $scope.$broadcast('redraw');
        });
      }
    }, true);

    // Convert gesture timeout to milliseconds.
    $scope.$watch('controls.gestureTimeout', (newValue, oldValue) => {
      var inMillis = Math.floor(newValue * 10) * 100;
      settings.gestureTimeout = inMillis;
    });

    // Get the mapping for a command.
    $scope.getMappingForCommand = (command) => {
      var commandId = command.id || command;
      return settings.mappings.find(mapping =>
        mapping.command === commandId);
    };

    // Get the mapping for a gesture.
    $scope.getMappingForGesture = (gesture) => {
      return settings.mappings.find(mapping =>
        mapping.gesture === gesture);
    };

    // Remove the mapping for a gesture.
    $scope.removeMappingForGesture = (gesture) => {
      var index = settings.mappings.findIndex(mapping => mapping.gesture === gesture);
      if (index >= 0) {
        settings.mappings.splice(index, 1);
      }
    };

    // Remove the mapping for a command.
    $scope.removeMappingForCommand = (command) => {
      var index = settings.mappings.findIndex(mapping => mapping.command === command.id);
      if (index >= 0) {
        settings.mappings.splice(index, 1);
      }
    };

    // Re-assign a gesture.
    $scope.assignGesture = (gesture, command) => {
      if (!gesture) {
        $scope.removeMappingForCommand(command);
        return;
      }

      // Prompt when re-assigning a command.
      var assigned = $scope.getMappingForGesture(gesture);
      if (assigned && (assigned.command !== command.id)) {
        var oldCommand = commands.findById(assigned.command);
        if (oldCommand) {
          var prompt = modules.helpers.format(
            '{} is already mapped to {}. Re-assign to {}?',
            gesture, oldCommand.label, command.label);
          if (!window.confirm(prompt)) {
            // Cancel assignment.
            return;
          }
        }
      }

      // Remove the old mappings for this command.
      $scope.removeMappingForGesture(gesture);
      $scope.removeMappingForCommand(command);

      // Insert the new mapping for this gesture.
      settings.mappings.push({
        command: command.id,
        gesture: gesture
      });
    };
  }]);

// -----------------------------------------------------------------------------
app.directive('mgGestureInput', [
  '$timeout',
  function ($timeout) {
    return {
      scope: {
        settings: '=',
        gesture: '=',
        onGesture: '&'
      },
      restrict: 'A',
      link: function (scope, element, attrs) {

        var canvas = element[0];
        var ctx = canvas.getContext('2d');
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        // Gesture mapping
        // ---------------------------------------------------------------------

        drawGesture();

        // Repaint the gesture on settings changed.
        scope.$watch('settings', (newValue) => {
          ctx.lineWidth = scope.settings.trailWidth || 2;
          ctx.strokeStyle = scope.settings.trailColor || '#000';
          drawGesture();
        }, true);

        // Repaint the gesture on gesture changed.
        scope.$watch('gesture', () => drawGesture());

        // Draw a line with an arrowhead.
        function arrowTo (paths, x, y, direction) {
          var arrowSize = 3;
          var subpath = [];
          paths.push([x, y]);
          switch (direction) {
            case 'U':
              paths.push([x - arrowSize, y + arrowSize]);
              paths.push([x + arrowSize, y + arrowSize]);
              break;
            case 'D':
              paths.push([x - arrowSize, y - arrowSize]);
              paths.push([x + arrowSize, y - arrowSize]);
              break;
            case 'L':
              paths.push([x + arrowSize, y - arrowSize]);
              paths.push([x + arrowSize, y + arrowSize]);
              break;
            case 'R':
              paths.push([x - arrowSize, y - arrowSize]);
              paths.push([x - arrowSize, y + arrowSize]);
              break;
          }
          paths.push([x, y]);
          return paths;
        }

        // Get a path to draw a gesture.
        function getGesturePath (moves) {
          var offsetSize = 5, legSize = 30;
          var path = [], x = 0, y = 0;
          path.push([[0, 0]]);
          moves.forEach(function (move) {
            var subpath = [[x, y]];
            switch (move) {
              case 'U':
                y -= legSize - offsetSize;
                x += offsetSize;
                break;
              case 'D':
                y += legSize + offsetSize;
                x += offsetSize;
                break;
              case 'L':
                y -= offsetSize;
                x -= legSize - offsetSize;
                break;
              case 'R':
                y -= offsetSize;
                x += legSize - offsetSize;
                break;
            }
            arrowTo(subpath, x, y, move);
            path.push(subpath);
          });
          return path;
        }

        // Get the bounding rectangle for a path.
        function getPathBoundingRect (paths) {
          var bounds = paths.reduce(function (bounds, subpath) {
            subpath.forEach(point => {
              bounds.top = Math.min(bounds.top, point[1]);
              bounds.bottom = Math.max(bounds.bottom, point[1]);
              bounds.right = Math.max(bounds.right, point[0]);
              bounds.left = Math.min(bounds.left, point[0]);
            });
            return bounds;
          }, { top: 0, bottom: 0, left: 0, right: 0 });
          bounds.width = bounds.right - bounds.left;
          bounds.height = bounds.bottom - bounds.top;
          return bounds;
        }

        // Draw the gesture.
        function drawGesture () {
          clearCanvas();
          if (scope.gesture) {
            // Get one or more paths describing the gesture.
            var moves = scope.gesture.split('');
            var paths = getGesturePath(moves);

            // Determine the offset to center the paths.
            var bounds = getPathBoundingRect(paths);
            var offset = {
              x: (width / 2) - (bounds.width / 2) - bounds.left,
              y: (height / 2) - (bounds.height / 2) - bounds.top
            };

            // Apply the offset to all points in the paths.
            paths.forEach(subpath => subpath.forEach(point => {
              point[0] += offset.x;
              point[1] += offset.y;
            }));

            // Draw the paths in the gesture.
            var alpha = 0.33;
            paths.forEach(function (subpath) {
              ctx.beginPath();
              ctx.globalAlpha = alpha;
              subpath.forEach(point => ctx.lineTo(point[0], point[1]));
              ctx.stroke();
              alpha += 0.67 / (paths.length - 1);
            });
          }
        }

        // Clear the canvas.
        function clearCanvas () {
          ctx.clearRect(0, 0, width, height);
        }

        // Gesture input
        // ---------------------------------------------------------------------

        var state = {
          inProgress: false,
          mouseOut: false,
          x: 0,
          y: 0
        };

        var deltaAccumulator = new MouseDeltaAccumulator();
        var gestureDetector = new UDLRGestureDetector();

        element.on('mousedown', onMouseDown);
        element.on('mouseup', onMouseUp);
        element.on('mousemove', onMouseMove);
        element.on('mouseleave', onMouseLeave);
        window.addEventListener('contextmenu', onContextMenu);

        scope.$on('$destroy', function () {
          element.off('mousedown', onMouseDown);
          element.off('mouseup', onMouseUp);
          element.off('mousemove', onMouseMove);
          element.off('mouseleave', onMouseLeave);
          window.removeEventListener('contextmenu', onContextMenu);
        });

        function getMouseData (event) {
          return {
            button: event.button,
            x: event.offsetX,
            y: event.offsetY,
            dx: event.movementX,
            dy: event.movementY
          };
        }

        function onMouseDown (event) {
          var mouseDown = getMouseData(event);
          if (event.button === scope.settings.gestureButton) {
            state.inProgress = true;
            state.contextMenu = false;
            deltaAccumulator.reset();
            gestureDetector.reset();
            state.x = mouseDown.x;
            state.y = mouseDown.y;
            clearCanvas();
          }
        }

        function onMouseUp (event) {
          if (event.button === scope.settings.gestureButton) {
            state.inProgress = false;
            scope.$apply(() => {
              scope.onGesture({ gesture: gestureDetector.gesture });
              drawGesture();
            });
          }
        }

        function onMouseMove (event) {
          if (state.inProgress) {
            var mouseMove = getMouseData(event);
            deltaAccumulator.accumulate(mouseMove);
            if (modules.helpers.distanceDelta(mouseMove) >= scope.settings.gestureFidelity) {
              deltaAccumulator.reset();
              gestureDetector.addPoint(mouseMove);

              // Draw a segment on the canvas.
              ctx.beginPath();
              ctx.moveTo(state.x, state.y);
              state.x += mouseMove.dx;
              state.y += mouseMove.dy;
              ctx.lineTo(state.x, state.y);
              ctx.stroke();
            }
          }
        }

        function onContextMenu (event) {
          if (!state.contextMenu) {
            event.preventDefault();
            event.stopPropagation();
          }
          state.contextMenu = true;
        }

        // Cancel the gesture on mouse leave.
        function onMouseLeave () {
          if (state.inProgress) {
            state.inProgress = false;
            scope.$apply(() => drawGesture());
          }
        }

      }
    };
  }]);
