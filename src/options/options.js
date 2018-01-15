/* global angular */
'use strict';

var app = angular.module('mgOptionsApp', [
  'ui.bootstrap',
  'ui.ace'
]);

// ---------------------------------------------------------------------------------------------------------------------
// Helper service that resolves a promise when modules are available.
app.factory('moduleLoader', [
  '$q',
  '$interval',
  function ($q, $interval) {
    // Get a function that returns a promise that is resolved when modules[module] is defined.
    return function (module) {
      if (modules[module]) {
        return $q.resolve(modules[module]);
      } else {
        var deferred = $q.defer();
        var promise = $interval(() => {
          if (modules[module]) {
            $interval.cancel(promise);
            deferred.resolve(modules[module]);
          }
        }, 100);
        return deferred.promise;
      }
    };
  }]);

// ---------------------------------------------------------------------------------------------------------------------
// A wrapper around the commands module that presents itself as an array of commands similar to the underlying module.
app.factory('commands', [
  'moduleLoader',
  function (moduleLoader) {
    var service = [];

    // Expose a non-enumerable property that is true once commands have been loaded.
    Object.defineProperty(service, 'loaded', {
      enumerable: false,
      writable: true,
      value: false
    });

    // Populate the service reference with the commands module when loaded.
    moduleLoader('commands').then(commands => {
      angular.extend(service, commands);
      service.loaded = true;
    });

    return service;
  }]);

// ---------------------------------------------------------------------------------------------------------------------
// A wrapper around the settings module that presents itself as a hash of settings similar to the underlying module.
app.factory('settings', [
  'moduleLoader',
  function (moduleLoader) {
    var service = {};

    // Expose a non-enumerable property that is true once settings have been loaded.
    Object.defineProperty(service, 'loaded', {
      enumerable: false,
      writable: true,
      value: false
    });

    // Populate the service reference with the settings module when loaded.
    var promise = moduleLoader('settings').then(module => module.loaded).then(settings => {
      angular.extend(service, settings);

      // Manually copy the non-enumerable data from the settings reference.
      Object.defineProperty(service, 'reset', {
        enumerable: false,
        // Sync the angular settings service with the underlying settings.
        value: () => settings.reset().then(() => angular.extend(service, settings))
      });

      // Manually copy the non-enumerable data from the settings reference.
      Object.defineProperty(service, 'templates', {
        enumerable: false,
        value: settings.getDefaultTemplates()
      });

      service.loaded = true;
    });

    // -----
    // Callable properties will throw a DataCloneError when persisting the settings object. Therefore, methods on the
    // settings object cannot be enumerable.
    // -----

    // Load settings from browser storage. Returns a promise that is resolved when settings are loaded.
    Object.defineProperty(service, 'load', {
      enumerable: false,
      value: () => promise.then(() => service)
    });

    // Save settings to browser storage. Returns a promise that is resolved when settings are saved.
    Object.defineProperty(service, 'save', {
      enumerable: false,
      value: () => browser.storage.sync.set(service)
        .catch(err => {
          console.log('error saving sync settings', err);
        })
    });

    return service;
  }]);

// ---------------------------------------------------------------------------------------------------------------------
// A wrapper around the commands module that presents itself as an array of commands similar to the underlying module.
app.directive('i18n', [
  function () {
    return {
      restrict: 'EA',
      scope: {
        i18n: '='
      },
      link: (scope, element, attrs) => {
        // Only treat the string as HTML if enabled by attribute.
        let setter = angular.isDefined(attrs.i18nHtml) ? 'innerHTML' : 'innerText';

        scope.$watch('i18n', args => {
          if (angular.isString(args)) {
            element[0][setter] = browser.i18n.getMessage(args);
          } else
          if (angular.isArray(args)) {
            let message = args.unshift();
            element[0][setter] = browser.i18n.getMessage(message, args);
          }
        });
      }
    };
  }]);

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsCtrl', [
  '$scope',
  '$controller',
  'commands',
  'settings',
  function ($scope, $controller, commands, settings) {

    // ----- Scope variables -----
    $scope.commands = commands;
    $scope.settings = settings;
    $scope.controls = {
      // Restore the previously active tab.
      activeTab: Number(window.localStorage.getItem('activeTab') || 0)
    };

    // ----- Extend controller -----

    $controller('OptionsTabGeneralCtrl', {
      $scope: $scope,
      settings: settings
    });

    $controller('OptionsTabCommandsCtrl', {
      $scope: $scope,
      commands: commands,
      settings: settings
    });

    $controller('OptionsTabUserScriptsCtrl', {
      $scope: $scope,
      commands: commands,
      settings: settings
    });

    $controller('OptionsTabOtherGesturesCtrl', {
      $scope: $scope,
      commands: commands,
      settings: settings
    });

    $controller('OptionsTabBackupCtrl', {
      $scope: $scope,
      settings: settings
    });

    // ----- Scope init -----

    // Initialize controls from settings on load.
    settings.load().then(() => {
      $scope.$broadcast('reset');
      $scope.$broadcast('redraw');
      $scope.startWatchingSettings();
    });

    // Functions -------------------------------------------------------------------------------------------------------

    // Expose a function to get lcoalized strings.
    $scope.i18n = (message, args) => browser.i18n.getMessage(message, args);

    // Start monitoring the settings for changes.
    $scope.startWatchingSettings = () => {
      return $scope.$watch('settings', newValue => {
        settings.save().then(() => {
          $scope.$broadcast('afterSettingsSaved');
          $scope.$broadcast('redraw');
        });
      }, true);
    };

    // Remember the active tab.
    $scope.onActiveTabChanged = ($event, index) => {
      if ($event) {
        window.localStorage.setItem('activeTab', index);
      }
    };

  }]);

// ---------------------------------------------------------------------------------------------------------------------
// Define the array index as a non-enumerable property of each item in an arrray.
// Useful to preserve the original array index when ordering an array in ng-repeat.
app.filter('index', [ function () {
  return function (array, index) {
    if (!index) {
      index = 'index';
    }

    for (let i = 0; i < array.length; ++i) {
        Object.defineProperty(array[i], index, {
          enumerable: false,
          configurable: true,
          value: i
        });
    }

    return array;
  };
}]);
