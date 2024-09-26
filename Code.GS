// File Name: Code.gs

// =========================
// Utility Functions
// =========================

/**
 * Generates a unique session ID based on the attendee's unique ID and current timestamp.
 * @param {string} uniqueId - The unique identifier of the attendee.
 * @returns {string} - The generated session ID.
 */
function generateSessionId(uniqueId) {
  var timestamp = new Date().getTime();
  return uniqueId + "-" + timestamp;
}

/**
 * Retrieves attendee information from the Legal sheet based on first and last name.
 * @param {string} firstName - The first name of the attendee.
 * @param {string} [lastName] - The last name of the attendee (optional).
 * @returns {Array} - An array of matching attendee objects.
 */
function getAttendeeInfo(firstName, lastName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var matches = [];

  firstName = firstName.toLowerCase().trim();
  if (lastName) lastName = lastName.toLowerCase().trim();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var sheetFirstName = data[i][3]; // Column D: First Name
    var sheetLastName = data[i][4];  // Column E: Last Name
    if (!sheetFirstName) continue;

    if (sheetFirstName.toString().trim().toLowerCase() === firstName) {
      if (lastName) {
        if (sheetLastName.toString().trim().toLowerCase() === lastName) {
          matches.push({
            uniqueId: data[i][16],
            firstName: data[i][3],
            lastName: data[i][4],
            phoneNumber: data[i][13],
            isMinor: data[i][5].toString().trim().toLowerCase() === 'yes',
            email: data[i][1],
            guardianFirstName: data[i][11],
            guardianLastName: data[i][12]
          });
        }
      } else {
        matches.push({
          uniqueId: data[i][16],
          firstName: data[i][3],
          lastName: data[i][4],
          phoneNumber: data[i][13],
          isMinor: data[i][5].toString().trim().toLowerCase() === 'yes',
          email: data[i][1],
          guardianFirstName: data[i][11],
          guardianLastName: data[i][12]
        });
      }
    }
  }
  return matches;
}

/**
 * Checks if a first name has duplicates in the Legal sheet.
 * @param {string} firstName - The first name to check for duplicates.
 * @returns {boolean} - True if duplicates exist, false otherwise.
 */
function checkDuplicateFirstName(firstName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var count = 0;

  firstName = firstName.toLowerCase().trim();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var legalFirstName = data[i][3];
    if (legalFirstName && legalFirstName.toString().trim().toLowerCase() === firstName) {
      count++;
      if (count > 1) return true;
    }
  }
  return false;
}

/**
 * Finds all available games from the VRSpaces sheet.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @returns {Array} - An array of unique supported games.
 */
 function findAvailableGames(vrSheet) {
  var supportedGamesSet = new Set();
  var data = vrSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var supportedGames = data[i][1]; // Column B: Supported Games
    if (supportedGames) {
      supportedGames.split(',').forEach(function(game) {
        supportedGamesSet.add(game.trim());
      });
    }
  }

  var gamesArray = Array.from(supportedGamesSet);
  return gamesArray;
}

/**
 * Finds available VR spaces that support the selected game.
 * @param {string} selectedGame - The game for which VR spaces are being searched.
 * @param {Sheet} vrSheet - The sheet containing VR spaces and their statuses.
 * @returns {Array} - An array of available spaces for the selected game.
 */
function findAvailableSpacesForGame(selectedGame, vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var availableSpaces = [];

  // Normalize the selectedGame to lowercase for comparison
  var normalizedSelectedGame = selectedGame.trim().toLowerCase();
  

  for (var i = 1; i < data.length; i++) {
    var status = data[i][2]; // Column C: VR Space Status (Available/Occupied)
    var supportedGames = data[i][1]; // Column B: Supported Games    

    if (status === 'Available') {
      // Normalize supported games for comparison
      var supportedGamesArray = supportedGames.split(',').map(game => game.trim().toLowerCase());
      

      // Check if the selected game is included in the supported games
      if (supportedGamesArray.includes(normalizedSelectedGame)) {
        availableSpaces.push(data[i][0]);
        
      } else {
        
      }
    }
  }
  return availableSpaces;
}

/**
 * Logs an error in the Tracker sheet based on session ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} sessionId - The session ID to log the error for.
 * @param {string} errorMessage - The error message to log.
 */
function setErrorFlag(trackerSheet, sessionId, errorMessage) {
  var data = trackerSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    if (data[i][0] === sessionId) {
      var rowToUpdate = i + 1;
      trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Column S: Error Flag
      trackerSheet.getRange(rowToUpdate, 18).setValue(errorMessage); // Column R: Notes
      break;
    }
  }
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} - The capitalized string.
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =========================
// Individual Check-In Functions
// =========================

/**
 * Initiates the individual check-in process.
 */
function checkIn() {
  try {
    var attendee = getIndividualAttendeeInfo();
    if (!attendee) return;
    var sessionId = generateSessionId(attendee.uniqueId);
    promptForGameSelection(attendee, sessionId);
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-in: ' + error.message);
  }
}

/**
 * Retrieves attendee information for individual check-in with retry logic for incorrect names.
 * @returns {Object|null} - The attendee object or null if not found/cancelled.
 */
function getIndividualAttendeeInfo() {
  var ui = SpreadsheetApp.getUi();
  var firstNameResponse, firstName, lastName, matches;

  // Retry loop for first name
  while (true) {
    firstNameResponse = ui.prompt('Individual Check-In', 'Please enter the first name of the attendee:', ui.ButtonSet.OK_CANCEL);

    if (firstNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }

    firstName = firstNameResponse.getResponseText().trim().toLowerCase();
    if (!firstName) {
      ui.alert('First name is required.');
      continue; // Retry entering first name
    }

    matches = getAttendeeInfo(firstName);

    if (matches.length === 1) {
      var attendee = matches[0];
      attendee.hasDuplicateName = false; // Explicitly set to false
      return attendee;
    } else if (matches.length === 0) {
      ui.alert('No attendee found with that first name. Please try again.');
      continue; // Retry entering first name
    } else {
      // Multiple matches found; prompt for last name
      while (true) {
        var lastNameResponse = ui.prompt('Multiple Matches Found', 'Multiple attendees found with the first name "' + capitalize(firstName) + '". Please enter the last name:', ui.ButtonSet.OK_CANCEL);

        if (lastNameResponse.getSelectedButton() !== ui.Button.OK) {
          ui.alert('Operation cancelled.');
          return null;
        }

        lastName = lastNameResponse.getResponseText().trim().toLowerCase();
        if (!lastName) {
          ui.alert('Last name is required.');
          continue; // Retry entering last name
        }

        matches = getAttendeeInfo(firstName, lastName);

        if (matches.length >= 1) {
          var attendee = matches[0]; // Pick the first match
          attendee.hasDuplicateName = matches.length > 1; // Set to true if duplicates exist
          return attendee;
        } else {
          ui.alert('No attendee found with that first and last name. Please try again.');
          continue; // Retry entering last name
        }
      }
    }
  }
}

/**
 * Prompts the user to select a game from available games.
 * @param {Object} attendee - The attendee object.
 * @param {string} sessionId - The generated session ID.
 */
function promptForGameSelection(attendee, sessionId) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);
    if (supportedGames.length === 0) {
      SpreadsheetApp.getUi().alert('No supported games found.');
      return;
    }

    // Store attendee data in script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('attendee_' + sessionId, JSON.stringify(attendee));

    // Create HTML form for game selection
    var template = HtmlService.createTemplateFromFile('GameSelection');
    template.supportedGames = supportedGames;
    template.sessionId = sessionId;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select Game');
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error in promptForGameSelection: ' + error.message);
  }
}

/**
 * Handles the game selection from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} sessionId - The session ID.
 */
function selectGame(selectedGame, sessionId) {
  try {
    // Retrieve attendee data from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var attendeeDataJSON = scriptProperties.getProperty('attendee_' + sessionId);
    var attendee = JSON.parse(attendeeDataJSON);
    scriptProperties.deleteProperty('attendee_' + sessionId); // Clean up

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');

    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

    if (availableSpaces.length > 0) {
      // Prompt for VR space selection
      promptForVRSpaceSelection(availableSpaces, attendee, selectedGame, sessionId);
    } else {
      // If no spaces are available, add to waitlist
      addToWaitlist(attendee, selectedGame, sessionId);
      SpreadsheetApp.getUi().alert('No available VR spaces for ' + selectedGame + '. Attendee added to waitlist.');
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during game selection: ' + error.message);
  }
}


/**
 * Prompts the user to select a VR space from available spaces.
 * @param {Array} availableSpaces - Array of available VR space names.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function promptForVRSpaceSelection(availableSpaces, attendee, selectedGame, sessionId) {
  try {
    // Store attendee data in script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('attendee_' + sessionId, JSON.stringify(attendee));

    var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.selectedGame = selectedGame;
    template.sessionId = sessionId;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select VR Space');
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error in promptForVRSpaceSelection: ' + error.message);
  }
}

/**
 * Handles the VR space selection from the HTML dialog.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function selectVRSpace(selectedSpace, selectedGame, sessionId) {
  try {
    // Retrieve attendee data from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var attendeeDataJSON = scriptProperties.getProperty('attendee_' + sessionId);
    var attendee = JSON.parse(attendeeDataJSON);
    scriptProperties.deleteProperty('attendee_' + sessionId); // Clean up

    // Continue with your logic
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // The attendee is checked in, not waitlisted
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('Attendee checked in to ' + selectedSpace + ' with game ' + selectedGame + '.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet for individual check-in and waitlist.
 * Instead of appending a new row, it updates the existing entry based on Session ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space or 'Waitlist'.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The unique session ID for this attendee.
 * @param {boolean} isWaitlisted - Indicates if the attendee is added to the waitlist.
 */
function updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isWaitlisted) {
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var currentTime = new Date();

  // Find the row in Tracker sheet matching the Session ID
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) { // Start at 1 to skip headers
    if (data[i][0] === sessionId) { // Column A: Session ID
      rowToUpdate = i + 1; // 1-based indexing for sheet rows
      break;
    }
  }

  if (rowToUpdate === -1) {
    // If not found, append a new row (optional)
    trackerSheet.appendRow([
      sessionId,                        // Column A: Session ID
      attendee.uniqueId || '',          // Column B: Unique ID
      attendee.firstName,               // Column C: First Name
      attendee.lastName || '',          // Column D: Last Name
      fullName,                         // Column E: Full Name
      "",                               // Column F: Group Leader
      "",                               // Column G: Group Number
      "",                               // Column H: Waitlist Time
      isWaitlisted ? "" : currentTime,  // Column I: Check-In Time
      "",                               // Column J: Check-Out Time
      "",                               // Column K: Waitlist Duration (Formula)
      "",                               // Column L: Session Duration (Formula)
      "",                               // Column M: Total Duration (Formula)
      selectedGame,                     // Column N: Game
      selectedSpace,                    // Column O: VR Space or 'Waitlist'
      isWaitlisted ? "Waiting" : "Active", // Column P: Session Status
      getVisitCount(trackerSheet, attendee.uniqueId), // Column Q: Visit Count
      "",                               // Column R: Notes
      "",                               // Column S: Error Flag
      ""                                // Column T: No Show
    ]);
    rowToUpdate = trackerSheet.getLastRow();
  } else {
    // Update existing row
    if (isWaitlisted) {
      trackerSheet.getRange(rowToUpdate, 8).setValue(""); // Column H: Waitlist Time cleared
      trackerSheet.getRange(rowToUpdate, 9).setValue(""); // Column I: Check-In Time cleared
      trackerSheet.getRange(rowToUpdate, 15).setValue("Waiting"); // Column P: Session Status
    } else {
      trackerSheet.getRange(rowToUpdate, 9).setValue(currentTime); // Column I: Check-In Time
      trackerSheet.getRange(rowToUpdate, 15).setValue("Active"); // Column P: Session Status
    }
    trackerSheet.getRange(rowToUpdate, 14).setValue(selectedGame); // Column N: Game
    trackerSheet.getRange(rowToUpdate, 15).setValue(isWaitlisted ? "Waiting" : "Active"); // Column P: Session Status
    trackerSheet.getRange(rowToUpdate, 16).setValue(getVisitCount(trackerSheet, attendee.uniqueId)); // Column Q: Visit Count

    // Optionally, you can set other columns if needed
  }

  // Update formulas for durations
  trackerSheet.getRange(rowToUpdate, 11).setFormula('=IF(H' + rowToUpdate + '="", "N/A", NOW()-H' + rowToUpdate + ')'); // Column K: Waitlist Duration
  trackerSheet.getRange(rowToUpdate, 12).setFormula('=IF(I' + rowToUpdate + '="", "N/A", NOW()-I' + rowToUpdate + ')'); // Column L: Session Duration
  trackerSheet.getRange(rowToUpdate, 13).setFormula('=IF(K' + rowToUpdate + '="N/A", L' + rowToUpdate + ', K' + rowToUpdate + ')'); // Column M: Total Duration
}

/**
 * Retrieves the visit count for an attendee based on Unique ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} uniqueId - The Unique ID of the attendee.
 * @returns {number} - The updated visit count.
 */
function getVisitCount(trackerSheet, uniqueId) {
  var data = trackerSheet.getDataRange().getValues();
  var visitCount = 1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === uniqueId) { // Column B: Unique ID
      var previousVisitCount = data[i][16]; // Column Q: Visit Count
      if (previousVisitCount && !isNaN(previousVisitCount)) {
        visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
      }
    }
  }
  return visitCount;
}


// =========================
// Group Check-In Functions
// =========================

/**
 * Initiates the group check-in process.
 */
function groupCheckIn() {
  var ui = SpreadsheetApp.getUi();
  try {
    // Prompt for the number of people in the group
    var groupSizeResponse = ui.prompt('Group Check-In', 'Enter the number of people in the group:', ui.ButtonSet.OK_CANCEL);
    if (groupSizeResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return;
    }
    var groupSize = parseInt(groupSizeResponse.getResponseText());
    if (isNaN(groupSize) || groupSize <= 0) {
      ui.alert('Invalid group size.');
      return;
    }

    // Prompt for the group leader's first name
    var groupLeaderFirstName = ui.prompt('Group Check-In', 'Enter the first name of the group leader:', ui.ButtonSet.OK_CANCEL).getResponseText().trim();
    var groupLeaderLastName = '';						
    if (!groupLeaderFirstName) {
      ui.alert('Group leader\'s first name is required.');
      return;
    }

    // Check for duplicate first names for group leader
    if (checkDuplicateFirstName(groupLeaderFirstName)) {
      groupLeaderLastName = ui.prompt('Group Check-In', 'Multiple attendees found with the first name "' + capitalize(groupLeaderFirstName) + '". Please enter the last name of the group leader:', ui.ButtonSet.OK_CANCEL).getResponseText().trim();
      if (!groupLeaderLastName) {
        ui.alert('Group leader\'s last name is required.');
        return;
      }
    }

    // Verify group leader's information
    var groupLeader = verifyGroupMember(groupLeaderFirstName, groupLeaderLastName, 'Group Leader');
    if (!groupLeader) return;
    var groupMembers = [groupLeader];

    // Collect and verify each group member's information
    for (var i = 2; i <= groupSize; i++) {
      var memberFirstName = ui.prompt('Group Check-In', 'Enter the first name of group member ' + i + ':', ui.ButtonSet.OK_CANCEL).getResponseText().trim();
      var memberLastName = '';
      if (!memberFirstName) {
        ui.alert('Group member ' + i + '\'s first name is required.');
        return;
      }

      // Check for duplicate first names for group member
      if (checkDuplicateFirstName(memberFirstName)) {
        memberLastName = ui.prompt('Group Check-In', 'Multiple attendees found with the first name "' + capitalize(memberFirstName) + '". Please enter the last name of group member ' + i + ':', ui.ButtonSet.OK_CANCEL).getResponseText().trim();
        if (!memberLastName) {
          ui.alert('Group member ' + i + '\'s last name is required.');
          return;
        }
      }

      var groupMember = verifyGroupMember(memberFirstName, memberLastName, 'Group Member ' + i);
      if (!groupMember) return;
      groupMembers.push(groupMember);
    }

    // Store group information in script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('groupSize', groupSize.toString());
    scriptProperties.setProperty('groupMembers', JSON.stringify(groupMembers));
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);

    if (supportedGames.length === 0) {
      ui.alert('No supported games found.');
      return;
    }

    // Prompt for game selection for the group
    var gameSelectionTemplate = HtmlService.createTemplateFromFile('GameSelectionGroup');
    gameSelectionTemplate.supportedGames = supportedGames;

    var gameHtmlOutput = gameSelectionTemplate.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(gameHtmlOutput, 'Select Game for Group');

  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}

/**
 * Verifies a group member's information based on first and last name.
 * If multiple matches exist, uses the first match and logs an error.
 * Implements retry logic for incorrect or missing names.
 * @param {string} firstName - The first name of the group member.
 * @param {string} lastName - The last name of the group member.
 * @param {string} role - The role of the group member (e.g., "Group Leader", "Group Member 2").
 * @returns {Object|null} - The attendee object or null if not found/cancelled.
 */
function verifyGroupMember(firstName, lastName, role) {
  var ui = SpreadsheetApp.getUi();
  var matches = getAttendeeInfo(firstName, lastName);

  // Retry loop for first and last name
  while (matches.length === 0) {
    var retryFirstNameResponse = ui.prompt(role, 'No attendee found with the first name "' + capitalize(firstName) + '". Please try again or click Cancel to exit.', ui.ButtonSet.OK_CANCEL);
    
    if (retryFirstNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }
    
    firstName = retryFirstNameResponse.getResponseText().trim().toLowerCase();
    if (!firstName) {
      ui.alert('First name is required.');
      continue; // Retry entering first name
    }

    matches = getAttendeeInfo(firstName); // Re-run with the new first name

    if (matches.length > 1) {
      // Retry loop for last name if multiple matches found
      var retryLastNameResponse = ui.prompt(role, 'Multiple attendees found with the first name "' + capitalize(firstName) + '". Please enter the last name or click Cancel to exit.', ui.ButtonSet.OK_CANCEL);
      
      if (retryLastNameResponse.getSelectedButton() !== ui.Button.OK) {
        ui.alert('Operation cancelled.');
        return null;
      }
      
      lastName = retryLastNameResponse.getResponseText().trim().toLowerCase();
      if (!lastName) {
        ui.alert('Last name is required.');
        continue; // Retry entering last name
      }
      
      matches = getAttendeeInfo(firstName, lastName);
    }
  }

  // If we get a single match or after retries, use the found member
  if (matches.length === 1) {
    return matches[0];
  }

  // If still multiple matches, use the first match but log the issue
  if (matches.length > 1) {
    setErrorFlag(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker'), matches[0].uniqueId, role + ': Multiple matches found. Used first match.');
    return matches[0];
  }

  // If no match after retries, return null
  ui.alert('No attendee found with the provided names for ' + role + '.');
  return null;
}

/**
 * Handles the game selection for the group from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user for the group.
 */
function selectGameGroup(selectedGame) {
  try {
    var scriptProperties = PropertiesService.getScriptProperties();
    var groupMembersJSON = scriptProperties.getProperty('groupMembers');

    if (!groupMembersJSON) {
      SpreadsheetApp.getUi().alert('Error: Group member data not found.');
      return;
    }

    var groupMembers = JSON.parse(groupMembersJSON);
    var groupSize = groupMembers.length;
    var groupNumber = generateGroupNumber();

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

    if (availableSpaces.length < groupSize) {
      // Not enough spaces for the entire group
      // Prompt to add the group to the waitlist
      promptForGroupWaitlist(groupMembers, selectedGame, groupSize, groupNumber);
      return;
    }

    // Generate session IDs for each group member
    for (var i = 0; i < groupMembers.length; i++) {
      var attendee = groupMembers[i];
      var sessionId = generateSessionId(attendee.uniqueId || '');
      attendee.sessionId = sessionId; // Store sessionId in the attendee object
    }

    // Update the groupMembers in script properties
    scriptProperties.setProperty('groupMembers', JSON.stringify(groupMembers));

    // Proceed with the group VR space selection
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers).replace(/'/g, "\\'");
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;
    template.callbackFunction = 'assignVRSpacesToGroup'; // Ensure the correct callback function

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred in selectGameGroup: ' + error.message);
  }
}

/**
 * Generates a unique group number based on the current timestamp.
 * @returns {number} - The generated group number.
 */
function generateGroupNumber() {
  return new Date().getTime(); // Unique group identifier
}

/**
 * Finds the row for a given VR space in the VRSpaces sheet.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} selectedSpace - The VR space to find.
 * @returns {number} The row number of the VR space, or -1 if not found.
 */
function findRowForVRSpace(vrSheet, selectedSpace) {
  var data = vrSheet.getDataRange().getValues(); // Get all the data from the sheet
  for (var i = 1; i < data.length; i++) { // Start at 1 to skip the header row
    if (data[i][0] === selectedSpace) { // Assuming the VR space is in the first column
      return i + 1; // Return the row number (adjust for 1-based indexing)
    }
  }
  return -1; // Return -1 if the space is not found
}

/**
 * Assigns VR spaces to the group members based on selected spaces.
 * Updates existing Tracker entries instead of appending new rows.
 * @param {Array} selectedSpaces - Array of selected VR space names.
 * @param {string} groupMembersJSON - JSON string of group members.
 * @param {string} selectedGame - The selected game for the group.
 * @param {string} groupNumber - Unique group number for the group.
 */
function assignVRSpacesToGroup(selectedSpaces, groupMembersJSON, selectedGame, groupNumber) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var groupMembers = JSON.parse(groupMembersJSON);

    // Ensure selectedSpaces length matches groupMembers length
    if (selectedSpaces.length !== groupMembers.length) {
      SpreadsheetApp.getUi().alert('Error: The number of selected VR spaces does not match the number of group members.');
      return;
    }

    for (var i = 0; i < groupMembers.length; i++) {
      var attendee = groupMembers[i];
      var selectedSpace = selectedSpaces[i];
      var isLeader = (i === 0); // Assume the first member is the group leader

      if (!attendee || !attendee.firstName || !attendee.lastName) {
        continue;
      }

      var sessionId = attendee.sessionId; // Use the sessionId generated earlier

      // Update the Tracker sheet and VR spaces
      updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber, groupMembers[0]); // Pass group leader
      updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    }

    SpreadsheetApp.getUi().alert('Group check-in completed successfully.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during group check-in: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet for group check-in and waitlist.
 * Updates the existing entry based on Session ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space or 'Waitlist'.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The unique session ID for this attendee.
 * @param {boolean} isLeader - Indicates if the attendee is the group leader.
 * @param {string} groupNumber - The unique group number.
 * @param {Object} groupLeader - The group leader object.
 */
function updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber, groupLeader) {
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var groupLeaderFullName = groupLeader.firstName + ' ' + (groupLeader.lastName || '');
  var currentTime = new Date();

  // Define column indices for clarity
  var colSessionId = 1; // Column A
  var colUniqueId = 2; // Column B
  var colFirstName = 3; // Column C
  var colLastName = 4; // Column D
  var colFullName = 5; // Column E
  var colGroupLeader = 6; // Column F
  var colGroupNumber = 7; // Column G
  var colWaitlistTime = 8; // Column H
  var colCheckInTime = 9; // Column I
  var colCheckOutTime = 10; // Column J
  var colWaitlistDuration = 11; // Column K
  var colSessionDuration = 12; // Column L
  var colTotalDuration = 13; // Column M
  var colGame = 14; // Column N
  var colVRSpace = 15; // Column O
  var colSessionStatus = 16; // Column P
  var colVisitCount = 17; // Column Q
  var colNotes = 18; // Column R
  var colErrorFlag = 19; // Column S
  var colNoShow = 20; // Column T

  // Determine session status based on selected space
  var isWaitlisted = (selectedSpace === 'Waitlist');
  var sessionStatus = isWaitlisted ? 'Waiting' : 'Active';

  // Find the row in Tracker sheet matching the Session ID
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) { // Start at 1 to skip headers
    if (data[i][colSessionId - 1] === sessionId) { // Column A: Session ID
      rowToUpdate = i + 1; // 1-based indexing for sheet rows
      break;
    }
  }

  if (rowToUpdate === -1) {
    // If not found, append a new row
    trackerSheet.appendRow([
      sessionId,                               // Column A: Session ID
      attendee.uniqueId || '',                 // Column B: Unique ID
      attendee.firstName,                      // Column C: First Name
      attendee.lastName || '',                 // Column D: Last Name
      fullName,                                // Column E: Full Name
      groupLeaderFullName,                     // Column F: Group Leader
      groupNumber || '',                       // Column G: Group Number
      isWaitlisted ? currentTime : '',         // Column H: Waitlist Time
      isWaitlisted ? '' : currentTime,         // Column I: Check-In Time
      "",                                      // Column J: Check-Out Time
      "",                                      // Column K: Waitlist Duration
      "",                                      // Column L: Session Duration
      "",                                      // Column M: Total Duration
      selectedGame,                            // Column N: Game
      selectedSpace,                           // Column O: VR Space or 'Waitlist'
      sessionStatus,                           // Column P: Session Status
      getVisitCount(trackerSheet, attendee.uniqueId), // Column Q: Visit Count
      "",                                      // Column R: Notes
      "",                                      // Column S: Error Flag
      ""                                       // Column T: No Show
    ]);
    rowToUpdate = trackerSheet.getLastRow();
  } else {
    // Update existing row
    if (isWaitlisted) {
      trackerSheet.getRange(rowToUpdate, colWaitlistTime).setValue(currentTime); // Column H: Waitlist Time
      trackerSheet.getRange(rowToUpdate, colSessionStatus).setValue("Waiting"); // Column P: Session Status
      trackerSheet.getRange(rowToUpdate, colVRSpace).setValue('Waitlist'); // Column O: VR Space
    } else {
      trackerSheet.getRange(rowToUpdate, colCheckInTime).setValue(currentTime); // Column I: Check-In Time
      trackerSheet.getRange(rowToUpdate, colSessionStatus).setValue("Active"); // Column P: Session Status
      trackerSheet.getRange(rowToUpdate, colVRSpace).setValue(selectedSpace); // Column O: VR Space
    }
    // Set common fields
    trackerSheet.getRange(rowToUpdate, colGame).setValue(selectedGame); // Column N: Game
    trackerSheet.getRange(rowToUpdate, colVisitCount).setValue(getVisitCount(trackerSheet, attendee.uniqueId)); // Column Q: Visit Count
  }

  // Update formulas for durations
  trackerSheet.getRange(rowToUpdate, colWaitlistDuration).setFormula('=IF(H' + rowToUpdate + '="", "N/A", NOW()-H' + rowToUpdate + ')'); // Column K: Waitlist Duration
  trackerSheet.getRange(rowToUpdate, colSessionDuration).setFormula('=IF(I' + rowToUpdate + '="", "N/A", NOW()-I' + rowToUpdate + ')'); // Column L: Session Duration
  trackerSheet.getRange(rowToUpdate, colTotalDuration).setFormula('=IF(K' + rowToUpdate + '="N/A", L' + rowToUpdate + ', K' + rowToUpdate + ')'); // Column M: Total Duration
}

/**
 * Adds a group to the waitlist.
 * @param {Array} groupMembers - Array of group members.
 * @param {string} selectedGame - The selected game for the group.
 * @param {number} groupNumber - Unique group number for the group.
 * @param {string} phoneNumber - Group leader's phone number for notifications.
 */
function addGroupToWaitlist(groupMembers, selectedGame, groupNumber, phoneNumber) {
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var checkInTime = new Date();

  // Generate session IDs for each group member
  for (var i = 0; i < groupMembers.length; i++) {
    var member = groupMembers[i];
    var sessionId = generateSessionId(member.uniqueId || '');
    member.sessionId = sessionId; // Store sessionId in the member object
  }

  // Proceed to add each group member to the waitlist
  for (var i = 0; i < groupMembers.length; i++) {
    var member = groupMembers[i];
    var sessionId = member.sessionId; // Use the sessionId generated earlier

    // Add the group member to the waitlist
    waitlistSheet.appendRow([
      sessionId,                          // Column A: Session ID
      groupNumber,                        // Column B: Group Number
      groupMembers[0].firstName,          // Column C: Group Leader
      member.firstName,                   // Column D: FName
      phoneNumber,                        // Column E: Phone Number
      selectedGame,                       // Column F: Game
      checkInTime,                        // Column G: WL Time
      "",                                 // Column H: Time Notified
      '=NOW()-G' + waitlistSheet.getLastRow(), // Column I: Time Since Added
      '=IF(H' + waitlistSheet.getLastRow() + '="", "", NOW()-H' + waitlistSheet.getLastRow() + ')' // Column J: Time Since Notified
    ]);

    // Now update the Tracker sheet
    var isLeader = (i === 0); // First member is the group leader
    updateCheckInTrackerGroup(trackerSheet, member, 'Waitlist', selectedGame, sessionId, isLeader, groupNumber, groupMembers[0]);
  }

  SpreadsheetApp.getUi().alert('Group has been added to the waitlist.');
}

/**
 * Prompts for the group leader's phone number and asks if the group should be added to the waitlist.
 * @param {Array} groupMembers - Array of group members.
 * @param {string} selectedGame - The selected game for the group.
 * @param {number} groupSize - Number of members in the group.
 * @param {number} groupNumber - Unique group number.
 */
function promptForGroupWaitlist(groupMembers, selectedGame, groupSize, groupNumber) {
  var ui = SpreadsheetApp.getUi();
  var leader = groupMembers[0]; // Assuming first member is the group leader
  var phoneNumber = leader.phoneNumber || '';

  var promptMessage = phoneNumber
    ? 'Not enough VR spaces available for the group.\n\nWould you like to add ' + leader.firstName + ' ' + leader.lastName + '\'s group to the waitlist?\n\nPhone Number: ' + phoneNumber + '\n\nClick Yes to confirm, No to enter a new number, or Cancel to cancel.'
    : 'Not enough VR spaces available for the group.\n\nWould you like to add ' + leader.firstName + ' ' + leader.lastName + '\'s group to the waitlist?\n\nNo phone number found.\n\nClick Yes to enter a phone number, or Cancel to cancel.';

  var response = ui.alert('Add Group to Waitlist', promptMessage, phoneNumber ? ui.ButtonSet.YES_NO_CANCEL : ui.ButtonSet.YES_CANCEL);

  // Handle the response
  if (response == ui.Button.YES) {
    if (!phoneNumber) {
      // Ask for phone number
      var phoneResponse = ui.prompt('Enter Phone Number', 'Please enter the group leader\'s phone number:', ui.ButtonSet.OK_CANCEL);
      if (phoneResponse.getSelectedButton() == ui.Button.OK) {
        phoneNumber = phoneResponse.getResponseText().trim();
        if (!phoneNumber) {
          ui.alert('Phone number is required to add the group to the waitlist.');
          return;
        }
      } else {
        ui.alert('Phone number is required to add the group to the waitlist.');
        return;
      }
    }
    // Add to the waitlist with the phone number
    addGroupToWaitlist(groupMembers, selectedGame, groupNumber, phoneNumber);
  } else if (response == ui.Button.NO && phoneNumber) {
    // Ask for a new phone number
    var newPhoneNumberResponse = ui.prompt('Enter New Phone Number', 'Please enter a new phone number for the group leader:', ui.ButtonSet.OK_CANCEL);
    if (newPhoneNumberResponse.getSelectedButton() == ui.Button.OK) {
      var newPhoneNumber = newPhoneNumberResponse.getResponseText().trim();
      if (newPhoneNumber) {
        phoneNumber = newPhoneNumber;
        addGroupToWaitlist(groupMembers, selectedGame, groupNumber, phoneNumber);
      } else {
        ui.alert('Phone number is required to add the group to the waitlist.');
        return;
      }
    } else {
      ui.alert('Operation cancelled. The group was not added to the waitlist.');
      return;
    }
  } else {
    ui.alert('Operation cancelled. The group was not added to the waitlist.');
    return;
  }
}


// =========================
// Update Functions
// =========================

/**
 * Updates the VRSpaces sheet to mark a VR space as occupied.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} selectedSpace - The selected VR space.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId) {
  var data = vrSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  // Find the row corresponding to the selected VR space
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSpace) { // Column A: VR Space
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate !== -1) {
    vrSheet.getRange(rowToUpdate, 3).setValue("Occupied");               // Column C: Status
    vrSheet.getRange(rowToUpdate, 4).setValue(attendee.firstName);        // Column D: First Name
    vrSheet.getRange(rowToUpdate, 5).setValue(selectedGame);              // Column E: Game
    vrSheet.getRange(rowToUpdate, 6).setValue(sessionId);                 // Column F: Session ID
    vrSheet.getRange(rowToUpdate, 7).setValue(new Date());                // Column G: Check-In Time
    // Column H: Duration remains untouched as per the requirement
  } else {
    throw new Error("VR Space not found: " + selectedSpace);
  }
}

/**
 * Handles the group check-in process after game selection.
 * Verifies each group member and assigns VR spaces or adds to waitlist.
 * @param {string} selectedGame - The game selected for the group.
 */
function proceedGroupCheckIn(selectedGame) {
  var ui = SpreadsheetApp.getUi();
  try {
    var scriptProperties = PropertiesService.getScriptProperties();
    var groupSize = parseInt(scriptProperties.getProperty('groupSize'));
    var groupMembers = JSON.parse(scriptProperties.getProperty('groupMembers'));
    scriptProperties.deleteAllProperties(); // Clean up

    var groupNumber = generateGroupNumber();
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

    if (availableSpaces.length < groupSize) {
      // Prompt to add the group to the waitlist
      promptForGroupWaitlist(groupMembers, selectedGame, groupSize, groupNumber);
      return;
    }

    // Proceed with assigning spaces
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers).replace(/'/g, "\\'");
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    ui.showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}

// =========================
// Check-Out Functions
// =========================

/**
 * Initiates the check-out process by displaying a list of occupied VR spaces.
 */
function checkOut() {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var occupiedSpaces = getOccupiedSpacesWithNames(vrSheet);

    if (occupiedSpaces.length === 0) {
      SpreadsheetApp.getUi().alert("No occupied VR spaces available for checkout.");
      return;
    }

    var template = HtmlService.createTemplateFromFile('CheckOutSelection');
    template.occupiedSpaces = occupiedSpaces;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Check Out Attendees');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-out: ' + error.message);
  }
}

/**
 * Retrieves occupied VR spaces with attendee names.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @returns {Array} - Array of occupied VR spaces with attendee first names.
 */
function getOccupiedSpacesWithNames(vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var occupiedSpaces = [];

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    if (data[i][2].toString().trim().toLowerCase() === "occupied") { // Column C: Status
      occupiedSpaces.push({
        space: data[i][0],        // Column A: VR Space
        firstName: data[i][3]     // Column D: FName
      });
    }
  }

  return occupiedSpaces;
}

/**
 * Processes the check-out of selected VR spaces.
 * @param {Array} selectedSpaces - An array of VR space names to check out.
 */
function processCheckOut(selectedSpaces) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var checkOutTime = new Date();

    for (var i = 0; i < selectedSpaces.length; i++) {
      var space = selectedSpaces[i];
      // Update the Tracker sheet
      updateCheckOutTracker(trackerSheet, space, checkOutTime);
      // Free up the VR space
      freeVRSpace(vrSheet, space);
    }

    SpreadsheetApp.getUi().alert('Selected VR spaces have been checked out.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing check-out: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet with check-out information.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} space - The VR space being checked out.
 * @param {Date} checkOutTime - The check-out time.
 */
function updateCheckOutTracker(trackerSheet, space, checkOutTime) {
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][14] === space && !data[i][9]) { // Column O: VR Space, Column J: Check-Out Time
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate === -1) {
    throw new Error('No active session found for VR Space: ' + space);
  }

  trackerSheet.getRange(rowToUpdate, 10).setValue(checkOutTime); // Column J: Check-Out Time

  // Update formulas for durations
  trackerSheet.getRange(rowToUpdate, 11).setFormula('=IF(H' + rowToUpdate + '="","N/A",NOW()-H' + rowToUpdate + ')'); // Column K: Waitlist Duration
  trackerSheet.getRange(rowToUpdate, 12).setFormula('=IF(I' + rowToUpdate + '="","N/A",NOW()-I' + rowToUpdate + ')'); // Column L: Session Duration
  trackerSheet.getRange(rowToUpdate, 13).setFormula('=IF(K' + rowToUpdate + '="N/A", L' + rowToUpdate + ', K' + rowToUpdate + ')'); // Column M: Total Duration

  trackerSheet.getRange(rowToUpdate, 16).setValue("Completed"); // Column P: Session Status
}

/**
 * Frees up a VR space by marking it as available and clearing attendee information.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} space - The VR space to free.
 */
function freeVRSpace(vrSheet, space) {
  var data = vrSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === space) { // Column A: VR Space
      vrSheet.getRange(i + 1, 3).setValue("Available"); // Column C: Status
      vrSheet.getRange(i + 1, 4, 1, 4).clearContent(); // Columns D-G: Clear attendee info
      // Column H: Duration remains untouched
      break;
    }
  }
}

// =========================
// Waitlist Management Functions
// =========================

/**
 * Adds an attendee to the waitlist.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function addToWaitlist(attendee, selectedGame, sessionId) {
  var ui = SpreadsheetApp.getUi();
  var phoneNumber = attendee.phoneNumber || "";

  var promptMessage = phoneNumber
    ? 'Would you like to add ' + attendee.firstName + ' ' + attendee.lastName + ' to the waitlist?\n\nPhone Number: ' + phoneNumber + '\n\nClick Yes to confirm, No to enter a new number, or Cancel to cancel.'
    : 'Would you like to add ' + attendee.firstName + ' ' + attendee.lastName + ' to the waitlist?\n\nNo phone number found.\n\nClick Yes to enter a phone number, or Cancel to cancel.';

  var response = ui.alert('Add to Waitlist', promptMessage, phoneNumber ? ui.ButtonSet.YES_NO_CANCEL : ui.ButtonSet.YES_CANCEL);

  if (response == ui.Button.YES && !phoneNumber) {
    phoneNumber = promptForPhoneNumber(ui);
  } else if (response == ui.Button.NO) {
    phoneNumber = promptForPhoneNumber(ui);
  } else if (response == ui.Button.CANCEL) {
    ui.alert('Submission canceled. Attendee was not added to the waitlist.');
    return;
  }

  if (!phoneNumber) return;
  var wlTime = new Date();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var rowToAdd = waitlistSheet.getLastRow() + 1;

  waitlistSheet.appendRow([
    sessionId,                      // Column A: Session ID
    '',                             // Column B: Group Number (Empty for individual)
    '',                             // Column C: Group Leader (Empty for individual)
    attendee.firstName,             // Column D: First Name
    phoneNumber,                    // Column E: Phone Number
    selectedGame,                   // Column F: Game
    wlTime,                         // Column G: Waitlist Time
    '',                             // Column H: Time Notified
    '=NOW()-G' + rowToAdd,          // Column I: Time Since Added
    '=IF(H' + rowToAdd + '="", "", NOW()-H' + rowToAdd + ')' // Column J: Time Since Notified
  ]);

  // Update tracker sheet with formulas for durations
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  updateCheckInTracker(trackerSheet, attendee, 'Waitlist', selectedGame, sessionId, true);

  ui.alert('Attendee ' + attendee.firstName + ' ' + attendee.lastName + ' has been successfully added to the waitlist.');
}

/**
 * Prompts the user to enter a phone number.
   * @param {UI} ui - The Spreadsheet UI instance.
   * @returns {string|null} - The entered phone number or null if cancelled.
   */
function promptForPhoneNumber(ui) {
  var phoneResponse = ui.prompt('Enter Phone Number', 'Please enter the attendee\'s phone number:', ui.ButtonSet.OK_CANCEL);
  if (phoneResponse.getSelectedButton() == ui.Button.OK) {
      var phoneNumber = phoneResponse.getResponseText().trim();
    if (!phoneNumber) {
      ui.alert('Phone number is required to add to the waitlist.');
      return null;
    }
    return phoneNumber;
  } else {
    ui.alert('Phone number is required to add to the waitlist.');
    return null;
  }
}

/**
 * Initiates the process to move an attendee from the waitlist to a VR space.
 */
function moveFromWaitlistToVRSpace() {
  try {
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var waitlistEntries = getWaitlistEntries(waitlistSheet);

    if (waitlistEntries.length === 0) {
      SpreadsheetApp.getUi().alert("No attendees are currently on the waitlist.");
      return;
    }

    // Create HTML form for waitlist selection
    var template = HtmlService.createTemplateFromFile('WaitlistSelection');
    template.waitlistEntries = waitlistEntries;
    template.title = 'Select Attendee to Move from Waitlist';
    template.buttonLabel = 'Assign VR Space';
    template.callbackFunction = 'processMoveFromWaitlist';

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Move Attendee from Waitlist');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while moving from waitlist: ' + error.message);
  }
}

/**
 * Processes moving an attendee or group from the waitlist to available VR spaces.
 * @param {string} selectedSessionId - The session ID of the attendee or group to move.
 */
function processMoveFromWaitlist(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // Find the waitlist entry
    var waitlistData = waitlistSheet.getDataRange().getValues();
    var selectedEntries = [];
    var groupNumber = null;
    var selectedGame = '';
    var sessionIds = [];

    // Find the selected entry and determine if it's a group or individual
    for (var i = 1; i < waitlistData.length; i++) {
      if (waitlistData[i][0] === selectedSessionId) { // Column A: SessionID
        groupNumber = waitlistData[i][1]; // Column B: Group Number
        selectedGame = waitlistData[i][5]; // Column F: Game
        break;
      }
    }

    if (groupNumber) {
      // It's a group; collect all group members
      for (var i = 1; i < waitlistData.length; i++) {
        if (waitlistData[i][1] === groupNumber) { // Column B: Group Number
          selectedEntries.push({
            sessionId: waitlistData[i][0],
            firstName: waitlistData[i][3],
            phoneNumber: waitlistData[i][4],
            uniqueId: waitlistData[i][0]
          });
          sessionIds.push(waitlistData[i][0]);
        }
      }
    } else {
      // Individual attendee
      for (var i = 1; i < waitlistData.length; i++) {
        if (waitlistData[i][0] === selectedSessionId) {
          selectedEntries.push({
            sessionId: waitlistData[i][0],
            firstName: waitlistData[i][3],
            phoneNumber: waitlistData[i][4],
            uniqueId: waitlistData[i][0]
          });
          selectedGame = waitlistData[i][5];
          sessionIds.push(waitlistData[i][0]);
          break;
        }
      }
    }

    if (selectedEntries.length === 0) {
      ui.alert('Attendee or group not found on the waitlist.');
      return;
    }

    // Find available spaces for the game
    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

    if (availableSpaces.length < selectedEntries.length) {
      ui.alert('Not enough available VR spaces for the game: ' + selectedGame);
      return;
    }

    // Prepare data for VR space selection
    var template;
    if (selectedEntries.length > 1) {
      // For groups
      template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
      template.availableSpaces = availableSpaces;
      template.groupSize = selectedEntries.length;
      template.groupMembers = JSON.stringify(selectedEntries).replace(/'/g, "\\'");
      template.selectedGame = selectedGame;
      template.groupNumber = groupNumber;
      template.callbackFunction = 'finalizeGroupMoveFromWaitlist';
    } else {
      // For individuals
      var attendeeData = selectedEntries[0];
      // Store attendee data in script properties
      var scriptProperties = PropertiesService.getScriptProperties();
      scriptProperties.setProperty('attendee_' + attendeeData.sessionId, JSON.stringify(attendeeData));

      template = HtmlService.createTemplateFromFile('VRSpaceSelection');
      template.availableSpaces = availableSpaces;
      template.selectedGame = selectedGame;
      template.sessionId = attendeeData.sessionId;
      template.callbackFunction = 'finalizeMoveFromWaitlist';
    }

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    ui.showModalDialog(htmlOutput, 'Assign VR Space');

  } catch (error) {
    ui.alert('An error occurred while processing move from waitlist: ' + error.message);
  }
}

/**
 * Finalizes moving a group from the waitlist to VR spaces.
 * @param {Array} selectedSpaces - Array of selected VR spaces.
 * @param {string} groupMembersJSON - JSON string of group members.
 * @param {string} selectedGame - The selected game.
 * @param {string} groupNumber - The group number.
 */
function finalizeGroupMoveFromWaitlist(selectedSpaces, groupMembersJSON, selectedGame, groupNumber) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var groupMembers = JSON.parse(groupMembersJSON);

    // Ensure selectedSpaces length matches groupMembers length
    if (selectedSpaces.length !== groupMembers.length) {
      SpreadsheetApp.getUi().alert('Error: The number of selected VR spaces does not match the number of group members.');
      return;
    }

    for (var i = 0; i < groupMembers.length; i++) {
      var attendee = groupMembers[i];
      var selectedSpace = selectedSpaces[i];
      var isLeader = (i === 0); // First member is the group leader

      if (!attendee || !attendee.firstName) {
        continue;
      }

      var sessionId = attendee.sessionId;

      // Update the Tracker sheet and VR spaces
      updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber, groupMembers[0]);
      updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    }

    // Remove the group from the waitlist
    removeFromWaitlist(waitlistSheet, groupMembers[0].sessionId);

    SpreadsheetApp.getUi().alert('Group assigned to VR spaces with game ' + selectedGame + '.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while finalizing group move from waitlist: ' + error.message);
  }
}

/**
 * Retrieves all waitlist entries.
 * @param {Sheet} waitlistSheet - The Waitlist sheet.
 * @returns {Array} - Array of waitlist entries.
 */
function getWaitlistEntries(waitlistSheet) {
  var data = waitlistSheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    var entry = {
      sessionId: data[i][0],      // Column A: Session ID
      groupNumber: data[i][1],    // Column B: Group Number
      groupLeader: data[i][2],    // Column C: Group Leader
      firstName: data[i][3],      // Column D: First Name
      phoneNumber: data[i][4],    // Column E: Phone Number
      game: data[i][5],           // Column F: Game
      wlTime: data[i][6],         // Column G: Waitlist Time
      rowIndex: i + 1
    };

    // Create display name
    if (entry.groupNumber) {
      entry.displayName = 'Group: ' + entry.groupLeader + ' - ' + entry.game;
    } else {
      entry.displayName = entry.firstName + ' - ' + entry.game;
    }

    // Avoid duplicates for group entries
    if (entry.groupNumber) {
      var alreadyAdded = entries.some(function(e) {
        return e.groupNumber === entry.groupNumber;
      });
      if (!alreadyAdded) {
        entries.push(entry);
      }
    } else {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Removes an attendee or group from the waitlist based on session ID.
 * @param {Sheet} waitlistSheet - The Waitlist sheet.
 * @param {string} sessionId - The session ID to remove.
 */
function removeFromWaitlist(waitlistSheet, sessionId) {
  var data = waitlistSheet.getDataRange().getValues();
  var groupNumber = null;

  // First, find the group number (if any) associated with the sessionId
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      groupNumber = data[i][1]; // Column B: Group Number
      break;
    }
  }

  if (groupNumber) {
    // Remove all entries with the same group number
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][1] === groupNumber) {
        waitlistSheet.deleteRow(i + 1);
      }
    }
  } else {
    // Remove the individual entry
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId) {
        waitlistSheet.deleteRow(i + 1);
        break;
      }
    }
  }
}

/**
 * Finalizes moving an individual from the waitlist to a VR space.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID of the attendee.
 */
function finalizeMoveFromWaitlist(selectedSpace, selectedGame, sessionId) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');

    // Retrieve attendee data from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var attendeeDataJSON = scriptProperties.getProperty('attendee_' + sessionId);
    if (!attendeeDataJSON) {
      SpreadsheetApp.getUi().alert('Error: Attendee data not found.');
      return;
    }
    var attendee = JSON.parse(attendeeDataJSON);
    scriptProperties.deleteProperty('attendee_' + sessionId); // Clean up

    // Update the Tracker sheet and VR spaces
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);

    // Remove the attendee from the waitlist
    removeFromWaitlist(waitlistSheet, sessionId);

    SpreadsheetApp.getUi().alert('Attendee assigned to VR space ' + selectedSpace + ' with game ' + selectedGame + '.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
  }
}

// =========================
// Mark as Notified Functions
// =========================

/**
 * Initiates the process to mark an attendee on the waitlist as notified.
 */
function markAsNotified() {
  try {
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var waitlistEntries = getWaitlistEntries(waitlistSheet);

    if (waitlistEntries.length === 0) {
      SpreadsheetApp.getUi().alert("No attendees are currently on the waitlist.");
      return;
    }

    var template = HtmlService.createTemplateFromFile('WaitlistSelection');
    template.waitlistEntries = waitlistEntries;
    template.title = 'Select Attendee to Mark as Notified';
    template.buttonLabel = 'Mark as Notified';
    template.callbackFunction = 'processMarkAsNotified';

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Mark Attendee as Notified');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while marking as notified: ' + error.message);
  }
}

/**
 * Processes marking an attendee or group as notified.
 * @param {string} selectedSessionId - The session ID of the attendee or group to mark as notified.
 */
function processMarkAsNotified(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var data = waitlistSheet.getDataRange().getValues();

    // Find the selected entry in the waitlist
    var selectedEntries = [];
    var groupNumber = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === selectedSessionId) { // Column A: Session ID
        groupNumber = data[i][1]; // Column B: Group Number
        break;
      }
    }

    if (groupNumber) {
      // It's a group; find all group members
      for (var i = 1; i < data.length; i++) {
        if (data[i][1] === groupNumber) { // Column B: Group Number
          selectedEntries.push({
            rowIndex: i + 1,
            sessionId: data[i][0],
            firstName: data[i][3],
            groupNumber: data[i][1]
          });
        }
      }
    } else {
      // Individual attendee
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === selectedSessionId) { // Column A: Session ID
          selectedEntries.push({
            rowIndex: i + 1,
            sessionId: data[i][0],
            firstName: data[i][3],
            groupNumber: data[i][1]
          });
          break;
        }
      }
    }

    if (selectedEntries.length === 0) {
      ui.alert('Attendee or group not found on the waitlist.');
      return;
    }

    // Update Time Notified for all selected entries
    var currentTime = new Date();
    for (var i = 0; i < selectedEntries.length; i++) {
      var rowIndex = selectedEntries[i].rowIndex;
      waitlistSheet.getRange(rowIndex, 8).setValue(currentTime); // Column H: Time Notified
      waitlistSheet.getRange(rowIndex, 10).setFormula('=NOW()-H' + rowIndex); // Column J: Time Since Notified
    }

    ui.alert('Attendee(s) have been marked as notified.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing mark as notified: ' + error.message);
  }
}

// =========================
// Mark as No Show Functions
// =========================

/**
 * Initiates the process to mark an attendee as a no-show.
 */
function markAsNoShow() {
  try {
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var data = trackerSheet.getDataRange().getValues();
    var waitingAttendees = [];

    for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
      if (data[i][15] === "Waiting") { // Column P: Session Status
        waitingAttendees.push({
          sessionId: data[i][0],     // Column A: Session ID
          firstName: data[i][2],     // Column C: First Name
          lastName: data[i][3]       // Column D: Last Name
        });
      }
    }

    if (waitingAttendees.length === 0) {
      SpreadsheetApp.getUi().alert('No attendees marked as "Waiting" in the Tracker.');
      return;
    }

    var template = HtmlService.createTemplateFromFile('NoShowSelection');
    template.waitingAttendees = waitingAttendees;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Mark Attendee as No Show');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while marking as no show: ' + error.message);
  }
}

/**
 * Processes marking an attendee as a no-show.
 * @param {string} selectedSessionId - The session ID of the attendee to mark as no-show.
 */
function processMarkAsNoShow(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var data = trackerSheet.getDataRange().getValues();
    var rowToUpdate = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === selectedSessionId && data[i][15] === "Waiting") { // Column A and P
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate === -1) {
      ui.alert('Invalid Session ID or attendee is not in "Waiting" status.');
      return;
    }

    // Update Tracker Sheet
    trackerSheet.getRange(rowToUpdate, 20).setValue(true);       // Column T: No Show Flag
    trackerSheet.getRange(rowToUpdate, 16).setValue("No Show");  // Column P: Session Status

    // Remove from Waitlist Sheet
    removeFromWaitlist(waitlistSheet, selectedSessionId);

    ui.alert('Attendee has been marked as No Show and removed from the waitlist.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing mark as no show: ' + error.message);
  }
}