'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabBackupCtrl', [
  '$scope',
  '$q',
  'settings',
  function ($scope, $q, settings) {

    // Functions -------------------------------------------------------------------------------------------------------

    // Get the addon information using an Angular promise.
    $scope.getManagementSelf = () => {
      let deferred = $q.defer();
      browser.management.getSelf().then(selfInfo => deferred.resolve(selfInfo), err => deferred.reject(err));
      return deferred.promise;
    };

    // Present a download to save the settings backup to a file.
    $scope.downloadSettings = () => {
      return $scope.getSettingsBackup().then(backupData => {
        // Stringify and serialize the backup data.
        let jsonData = JSON.stringify(backupData, null, 2);
        let dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonData);

        // Prompt the user to download the backup.
        let a = document.createElement('a');
        a.href = dataUrl;
        a.download = backupData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    };

    // Read a File instance and parse it as JSON.
    $scope.readFileAsJson = (file) => {
      let deferred = $q.defer();
      let reader = new window.FileReader();
      reader.onload = () => {
        try {
          deferred.resolve(JSON.parse(reader.result));
        } catch (err) {
          deferred.reject(err);
        }
      };
      reader.onerror = () => deferred.reject(reader.error);
      reader.readAsText(file);
      return deferred.promise;
    };

    // Generate a backup of the settings with metadata.
    $scope.getSettingsBackup = () => $scope.getManagementSelf().then(selfInfo => {
      let backupData = {};

      // Generate a filename for this backup.
      backupData.timestamp = new Date();
      backupData.fileName = 'foxyGestures.' + [
          String(backupData.timestamp.getFullYear()),
          String(backupData.timestamp.getMonth() + 1).padStart(2, '0'),
          String(backupData.timestamp.getDate()).padStart(2, '0')
        ].join('-') + '.json';

      // Record the current addon version.
      backupData.addonId = selfInfo.id;
      backupData.version = selfInfo.version;

      // Clone the settings object.
      backupData.settings = angular.copy(settings);
      return backupData;
    });

    // Do basic checks to validate the correctness of the backup data.
    $scope.validateBackupData = (backupData, selfInfo) => {
      // Check the addon ID to ensure this is a Foxy Gestures backup.
      if (backupData.addonId !== selfInfo.id) {
        console.log('invalid addon ID', backupData.addonId);
        window.alert(browser.i18n.getMessage('alertBackupNotRecognized'));
        return false;
      }

      // Parse the version number from the backup.
      backupData.$version = modules.helpers.parseAddonVersion(backupData.version);
      if (!backupData.$version) {
        console.log('invalid version', backupData.version);
        window.alert(browser.i18n.getMessage('alertBackupInvalidVersion'));
        return false;
      }

      // Ensure that the settings key is present as an object.
      if (typeof backupData.settings !== 'object') {
        console.log('invalid settings property', backupData.settings);
        window.alert(browser.i18n.getMessage('alertBackupCorrupt'));
        return false;
      }

      return true;
    };

    // Overwrite settings keys with values from the backup.
    // Any version specific quirks or upgrades would go here.
    $scope.overwriteSettings = (backupData, selfInfo) => {
      angular.copy(backupData.settings, settings);
    };

    // Restore a Settings from a backup file and then reset the options form.
    $scope.restoreSettings = (files) => {
      $q.all({
        backupData: $scope.readFileAsJson(files[0]),
        selfInfo: $scope.getManagementSelf()
      }).then(result => {
        // Do basic checks to validate the correctness of the backup data.
        if (!$scope.validateBackupData(result.backupData, result.selfInfo)) {
          return;
        }

        // Overwrite settings keys with values from the backup.
        $scope.overwriteSettings(result.backupData, result.selfInfo);

        // Reset any indirectly bound controls like numeric inputs.
        $scope.$broadcast('reset');

        // Reset the settings form to display model values.
        $scope.controls.optionsForm.$rollbackViewValue();
        $scope.controls.optionsForm.$setPristine();
        $scope.controls.optionsForm.$setUntouched();

        // Confirm settings have been restored.
        window.alert(browser.i18n.getMessage('alertBackupRestored'));
      }).catch(err => {
        // Something went wrong andw as unhandled.
        console.log('unable to restore settings', err);
        window.alert(browser.i18n.getMessage('alertBackupCorrupt'));
      });
    };

    // Reset all settings back to default.
    $scope.resetSettings = () => {
      if (window.confirm(browser.i18n.getMessage('confirmResetSettings'))) {
        settings.reset();
      }
    };

  }]);

// ---------------------------------------------------------------------------------------------------------------------
// Evaluate an expression when the change event of a input[type=file] fires.
app.directive('fgFileChanged', [
  function () {
    return {
      scope: {
        fgFileChanged: '&'
      },
      link: function (scope, element) {
        let callback = () => scope.$apply(() => scope.fgFileChanged({ files: element[0].files }));
        scope.$on('$destroy', () => element.off('change', callback));
        element.on('change', callback);
      }
    };
  }]);
