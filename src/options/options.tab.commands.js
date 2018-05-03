'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabCommandsCtrl', [
  '$scope',
  '$filter',
  'commands',
  'settings',
  function ($scope, $filter, commands, settings) {

    // ----- Scope watches -----
    $scope.$watch('controls.searchCommands', (newValue) => {
      let array = [];
      array.$lookup = {};
      $scope.commandGroups = $filter('filter')(commands, newValue).reduce((array, command) => {
        let index = array.$lookup[command.group.id];
        if (index !== undefined) {
          array[index].members.push(command);
        } else {
          array.$lookup[command.group.id] = array.length;
          array.push(angular.extend({}, command.group, { members: [ command ] }));
        }
        return array;
      }, array);
    });

    // Functions -------------------------------------------------------------------------------------------------------

    // Find a command by ID.
    $scope.findCommandById = (id) =>
      Optional.of(commands.find(command => command.id === id));

    // Get the mapping for a gesture.
    $scope.getMappingForGesture = (gesture) => {
      return settings.mouseMappings.find(mapping => mapping.gesture === gesture);
    };

    // Get the mapping for a command.
    $scope.getMappingForCommand = (command) => {
      var id = command.id || command;
      return settings.mouseMappings.find(mapping => mapping.command === id);
    };

    // Remove the mapping for a gesture.
    $scope.removeMappingForGesture = (gesture) => {
      var index = settings.mouseMappings.findIndex(mapping => mapping.gesture === gesture);
      if (index >= 0) {
        settings.mouseMappings.splice(index, 1);
      }
    };

    // Remove the mapping for a command.
    $scope.removeMappingForCommand = (command) => {
      var index = settings.mouseMappings.findIndex(mapping => mapping.command === command.id);
      if (index >= 0) {
        settings.mouseMappings.splice(index, 1);
      }
    };

    // Prompt if the gesture is assigned to another command.
    $scope.promptIfGestureInUse = (gesture, label, selfAssignmentTest) => {
      // Do not prompt if gesture is mapped to itself.
      var mapping = $scope.getMappingForGesture(gesture);
      if (!mapping || selfAssignmentTest(mapping)) {
        return true;
      }

      // Find the item that is currently assigned via the mapping.
      let assigned = Optional.EMPTY
        // Check user scripts for a matching user script ID.
        .or(() => $scope.findUserScriptById(mapping.userScript)
          .map(userScript => (userScript.label) ?
              browser.i18n.getMessage('userScriptWithName', userScript.label) :
              browser.i18n.getMessage('userScriptNoName')))
        // Check commands for a matching command ID.
        .or(() => $scope.findCommandById(mapping.command)
          .map(value => value.label));

      // Prompt if the assignment is valid.
      if (assigned.isPresent() && !window.confirm(browser.i18n.getMessage(
        'confirmReassignGesture', [ gesture, assigned.get(), label ]))
      ) {
        // Cancel assignment.
        return false;
      }

      return true;
    };

    // Assign a gesture to a built in command.
    $scope.assignGestureToCommand = (gesture, command) => {
      if (!gesture) {
        $scope.removeMappingForCommand(command);
        return;
      }

      // Assign the gesture only if permissions are granted.
      $scope.showAskPermissionModal(command.permissions || [])
        .then(granted => {
          if (granted) {
            // Prompt when re-assigning a gesture.
            if (!$scope.promptIfGestureInUse(gesture, command.label, mapping => mapping.command === command.id)) {
              // Assignment cancelled.
              return;
            }

            // Remove the old mappings for this command.
            $scope.removeMappingForGesture(gesture);
            $scope.removeMappingForCommand(command);

            // Insert the new mapping for this gesture.
            settings.mouseMappings.push({
              command: command.id,
              gesture: gesture
            });
          } else {
            // Remove the mapping for this command.
            $scope.removeMappingForCommand(command);
          }
        });
    };

    $scope.getPermissionTooltip = (permissions) => {
      return browser.i18n.getMessage('tooltipRequiresPermissions', permissions.join(', '));
    };

  }]);
