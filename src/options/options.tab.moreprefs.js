'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabMorePrefsCtrl', [
  '$scope',
  'commands',
  'settings',
  function ($scope, commands, settings) {

    // Functions -------------------------------------------------------------------------------------------------------

    // Remove all mappings for commands that require this permission.
    $scope.removeMappingRequiresPermission = (permission) => {
      // Remove the mappings for all mouse gesture commands that require this permission.
      commands.forEach(command => {
        if (command.permissions && !!~command.permissions.indexOf(permission)) {
          // Remove the mapping for this command.
          $scope.removeMappingForCommand(command);
        }
      });

      // Remove the mappings for all wheel gesture commands that require this permission.
      Object.keys($scope.settings.wheelMappings)
        .map(key => {
          let wheelMapping = $scope.settings.wheelMappings[key];
          if (wheelMapping && wheelMapping.command) {
            commands.findById(wheelMapping.command).ifPresent(command => {
              if (command && command.permissions && !!~command.permissions.indexOf(permission)) {
                // Remove the mapping for this command.
                $scope.controls.wheelMappings[key] = $scope.noCommand;
                $scope.settings.wheelMappings[key] = $scope.noCommand.mapping;
              }
            });
          }
        });

      // Remove the mappings for all chord gesture commands that require this permission.
      $scope.settings.chordMappings
        .map((chordMapping, index) => {
          if (chordMapping && chordMapping.mapping) {
            commands.findById(chordMapping.mapping.command).ifPresent(command => {
            if (command && command.permissions && !!~command.permissions.indexOf(permission)) {
              // Remove the mapping for this command.
              $scope.controls.chordMappings[index] = $scope.noCommand;
              chordMapping.mapping = $scope.noCommand.mapping;
            }
          });
        }
      });
    };

    // Request an optional permission.
    $scope.requestPermission = (permission) => {
      return browser.permissions.request({ permissions: [ permission ] })
        // Update the optional permissions.
        .then($scope.updateOptionalPermissions);
    };

    // Revoke an optional permission.
    $scope.revokePermission = (permission) => {
      return browser.permissions.remove({ permissions: [ permission ] })
        .then(removed => {
          if (removed) {
            // Remove all mappings for commands that require this permission.
            $scope.removeMappingRequiresPermission(permission);

            // Update the optional permissions.
            $scope.updateOptionalPermissions();
          }
        });
    };

  }]);
