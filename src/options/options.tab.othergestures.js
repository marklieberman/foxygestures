'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabOtherGesturesCtrl', [
  '$scope',
  'commands',
  'settings',
  '$uibModal',
  function ($scope, commands, settings, $uibModal) {

    // ----- Scope variables -----
    $scope.mappables = [];
    $scope.noCommand = {
      id: null,
      label: browser.i18n.getMessage('noCommand'),
      mapping: null
    };

    angular.extend($scope.controls, {
      wheelMappings: {
        up: $scope.noCommand,
        down: $scope.noCommand,
        left: $scope.noCommand,
        right: $scope.noCommand
      },
      chordMappings: []
    });

    // ----- Publish functions -----
    $scope.getChordPreview = modules.helpers.getChordPreview;
    $scope.updateMappables = updateMappables;
    $scope.updateWheelMappings = updateWheelMappings;
    $scope.updateChordMappings = updateChordMappings;
    $scope.addChordMapping = addChordMapping;
    $scope.removeChordMapping = removeChordMapping;

    // ----- Event handlers -----
    $scope.$on('reset', () => {
      $scope.updateMappables();
      $scope.updateWheelMappings();
      $scope.updateChordMappings();
    });

    $scope.$on('afterSettingsSaved', () => {
      $scope.updateMappables();
      $scope.updateWheelMappings();
      $scope.updateChordMappings();
    });

    // Functions -------------------------------------------------------------------------------------------------------

    // Update the list of mappable commands.
    function updateMappables () {
      $scope.mappables = [$scope.noCommand].concat(
        // Add built-in commands.
        commands.map(command => ({
          id: command.id,
          label: command.label,
          mapping: {
            command: command.id
          },
          group: command.group.label,
          groupOrder: command.group.order
        })).sort((a, b) => {
          // Sort by group order then command label.
          let value = a.groupOrder - b.groupOrder;
          return (value === 0) ? a.label.localeCompare(b.label) : value;
        }),
        // Add user scripts.
        settings.userScripts.map(userScript => ({
          id: userScript.id,
          label: (userScript.label ?
            browser.i18n.getMessage('userScriptWithName', userScript.label) :
            browser.i18n.getMessage('userScriptNoName')),
          mapping: {
            command: 'userScript',
            userScript: userScript.id
          },
          group: browser.i18n.getMessage('groupCommandsUserScripts')
        })).sort((a, b) => a.label.localeCompare(b.label))
      );
    }

    // Update the bound controls for the wheel mappings.
    function updateWheelMappings () {
      [ 'up', 'down', 'left', 'right' ].forEach(key => {
        let boundMappable = $scope.mappables.find(
          mappable => angular.equals(mappable.mapping, settings.wheelMappings[key]));

        if (boundMappable) {
          // Found the mappable so update the bound control.
          $scope.controls.wheelMappings[key] = boundMappable;
        } else {
          // Mappable not found so reset the mapping.
          $scope.controls.wheelMappings[key] = $scope.noCommand;
          $scope.settings.wheelMappings[key] = $scope.noCommand.mapping;
        }
      });
    }

    // Update the bound controls for the chord mappings.
    function updateChordMappings () {
      $scope.settings.chordMappings.forEach((chordMapping, index) => {
        let boundMappable = $scope.mappables.find(
          mappable => angular.equals(mappable.mapping, chordMapping.mapping));

          if (boundMappable) {
            // Found the mappable so update the bound control.
            $scope.controls.chordMappings[index] = boundMappable;
          } else {
            // Mappable not found so reset the mapping.
            $scope.controls.chordMappings[index] = $scope.noCommand;
            chordMapping.mapping = $scope.noCommand.mapping;
          }
      });
    }

    // Add a mapping for a chord gesture.
    function addChordMapping () {
      let modal = $uibModal.open({
        controller: 'ModalChordGesturesCtrl',
        templateUrl: 'modal.chordGesture.html',
        backdrop: 'static',
        resolve: () => ({ settings: settings })
      });

      modal.result
        // Add an empty mapping for the chord.
        .then(chord => $scope.settings.chordMappings.push({ chord: chord, mapping: $scope.noCommand.mapping }))
        // Suppress unhandled promise rejection.
        .catch(err => err && console.log(err));
    }

    // Remove a mapping for a chord gesture.
    function removeChordMapping (chordMapping) {
      if (window.confirm(browser.i18n.getMessage('confirmRemoveChord',
        modules.helpers.getChordPreview(chordMapping.chord)))
      ) {
        settings.chordMappings = settings.chordMappings.filter(mapping => mapping !== chordMapping);
      }
    }

  }]);

// ---------------------------------------------------------------------------------------------------------------------
app.controller('ModalChordGesturesCtrl', [
  '$scope',
  'settings',
  function ($scope, settings) {

    // ----- Scope variables -----
    $scope.controls = {
      reset: true,
      record: true,
      chord: [],
      error: 'short'
    };

    // ----- Publish functions -----
    $scope.getChordPreview = modules.helpers.getChordPreview;
    $scope.validateChord = validateChord;

    // ----- Event handlers -----

    // Remove the global mouse down handler.
    $scope.$on('$destroy', () => {
      window.removeEventListener('dragstart', preventHandler, true);
      window.removeEventListener('selectstart', preventHandler, true);
      window.removeEventListener('contextmenu', preventHandler, true);
      window.removeEventListener('mousedown', mouseDownHandler, true);
      window.removeEventListener('mouseup', mouseUpHandler, true);
    });

    // ---- Controller init ----

    // Install a global mouse down handler.
    window.addEventListener('mouseup', mouseUpHandler, true);
    window.addEventListener('mousedown', mouseDownHandler, true);
    window.addEventListener('contextmenu', preventHandler, true);
    window.addEventListener('selectstart', preventHandler, true);
    window.addEventListener('dragstart', preventHandler, true);

    // Functions -------------------------------------------------------------------------------------------------------

    // Handle mouse down when recording a chord.
    function mouseDownHandler (event) {
      // Allow clicks on the OK and cancel buttons.
      if (event.target.tagName === 'BUTTON') {
        return;
      }

      $scope.$apply(() => {
        // Start a new chord when the reset flag is set.
        if ($scope.controls.reset) {
          $scope.controls.chord = [];
          $scope.controls.reset = false;
        }

        // Add a button to the chord when recording.
        if ($scope.controls.record) {
          $scope.controls.chord.push(event.button);
          $scope.validateChord();
        }
      });
    }

    // Handle mouse up when recording a chord.
    function mouseUpHandler (event) {
      $scope.$apply(() => {
        if (event.buttons === 0) {
          // Reset the chord when all buttons are released.
          $scope.controls.reset = true;
          $scope.controls.record = true;
        } else {
          // Stop recording when a button is released.
          $scope.controls.record = false;
        }
      });
    }

    // Prevent the default action for this event.
    function preventHandler (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Validate a chord's length and check for conflicts.
    function validateChord () {
      // Check if the cord meets the minimum length.
      let chord = $scope.controls.chord;
      if (chord.length < 2) {
        $scope.controls.error = 'short';
      } else {
        // Check the chord for a conflict with an existing chord.
        $scope.controls.error = !!settings.chordMappings.find(mapping => {
          let n = Math.min(chord.length, mapping.chord.length);
          for (let i = 0; i < n; i++) {
            if (chord[i] != mapping.chord[i]) {
              return false;
            }
          }
          return true;
        }) ? 'conflict' : null;
      }

      return $scope.controls.error;
    }

  }]);
