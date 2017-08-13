'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabOtherGesturesCtrl', [
  '$scope',
  'commands',
  'settings',
  function ($scope, commands, settings) {

    // ---- Scope variables -----
    $scope.mappables = [];
    $scope.noCommand = {
      id: null,
      label: '-- No Command --',
      mapping: null
    };

    angular.extend($scope.controls, {
      wheelMappings: {
        up: $scope.noCommand,
        down: $scope.noCommand,
        left: $scope.noCommand,
        right: $scope.noCommand
      }
    });

    // ----- Event handlers -----
    $scope.$on('reset', () => {
      $scope.updateMappables();
      $scope.updateWheelMappings();
    });

    $scope.$on('afterSettingsSaved', () => {
      $scope.updateMappables();
      $scope.updateWheelMappings();
    });

    // Functions -------------------------------------------------------------------------------------------------------

    // Update the list of mappable commands.
    $scope.updateMappables = () => {
      $scope.mappables = [$scope.noCommand].concat(
        // Add built-in commands.
        commands.map(command => ({
          id: command.id,
          label: command.label,
          mapping: {
            command: command.id
          }
        })),
        // Add user scripts.
        settings.userScripts.map(userScript => ({
          id: userScript.id,
          label: userScript.label || 'User Script',
          mapping: {
            command: 'userScript',
            userScript: userScript.id
          }
        })));
    };

    // Update the assigned wheel gesture mappings.
    $scope.updateWheelMappings = () => {
      [ 'up', 'down', 'left', 'right' ].forEach(key => {
        $scope.controls.wheelMappings[key] = $scope.mappables.find(
          mappable => angular.equals(mappable.mapping, settings.wheelMappings[key])) || $scope.noCommand;
      });
    };

  }]);

// ---------------------------------------------------------------------------------------------------------------------
