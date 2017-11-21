'use strict';

// ---------------------------------------------------------------------------------------------------------------------
app.controller('OptionsTabUserScriptsCtrl', [
  '$scope',
  'commands',
  'settings',
  function ($scope, commands, settings) {

    // ---- Scope variables -----

    // Options for ACE editor.
    $scope.aceOpts = {
      theme: 'chrome',
      mode: 'javascript',
      showPrintMargin: false,

      // Suppress the warning in the console.
      onLoad: editor => editor.$blockScrolling = Infinity
    };

    // Functions -------------------------------------------------------------------------------------------------------

    // Find a user script by ID.
    $scope.findUserScriptById = (id) =>
      Optional.of(settings.userScripts.find(userScript => userScript.id === id));

    // Get the mapping for a gesture.
    $scope.getMappingForUserScript = (userScript) => {
      return settings.mouseMappings
        .filter(mapping => mapping.command === 'userScript')
        .find(mapping => mapping.userScript === userScript.id);
    };

    // Remove the mapping for a command.
    $scope.removeMappingForUserScript = (userScript) => {
      var index = settings.mouseMappings.findIndex(mapping => mapping.userScript === userScript.id);
      if (index >= 0) {
        settings.mouseMappings.splice(index, 1);
      }
    };

    // Assign a gesture to a user script.
    $scope.assignGestureToUserScript = (gesture, userScript) => {
      if (!gesture) {
        $scope.removeMappingForUserScript(userScript);
        return;
      }

      let label = (userScript.label ?
        browser.i18n.getMessage('userScriptWithName', userScript.label) :
        browser.i18n.getMessage('userScriptNoName'));

      // Prompt when re-assigning a gesture.
      if (!$scope.promptIfGestureInUse(gesture, label, mapping => mapping.userScript === userScript.id)) {
        // Assignment cancelled.
        return;
      }

      // Remove the old mappings for this command.
      $scope.removeMappingForUserScript(userScript);
      $scope.removeMappingForGesture(gesture);

      // Assign the gesture to this user script.
      // Insert the new mapping for this gesture.
      settings.mouseMappings.push({
        command: 'userScript',
        gesture: gesture,
        userScript: userScript.id
      });
    };

    // Add a user script.
    $scope.addUserScript = () => {
      let userScriptId = 'userScript:' + new Date().getTime();
      settings.userScripts.push({ id: userScriptId, label: '', script: '' });
    };

    // Remove a user script.
    $scope.removeUserScript = (removing) => {
      // Confirm before deleting.
      let label = (removing.label ?
        browser.i18n.getMessage('userScriptWithName', removing.label) :
        browser.i18n.getMessage('userScriptNoName'));

      if (window.confirm(browser.i18n.getMessage('confirmRemoveUserScript', label))) {
        // Remove the mapping for this user script.
        $scope.removeMappingForUserScript(removing);

        let index = settings.userScripts.findIndex(userScript => userScript === removing);
        if (index >= 0) {
          // Remove the user script.
          settings.userScripts.splice(index, 1);
        }
      }
    };

  }]);

// ---------------------------------------------------------------------------------------------------------------------
