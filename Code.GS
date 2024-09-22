// File Name: Code.gs

// =========================
// Main Menu Creation
// =========================

function onOpen() { 
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('VR Zone')
    .addItem('Individual Check-In', 'checkIn')
    .addItem('Group Check-In', 'groupCheckIn')
    .addItem('Check-Out', 'checkOut')
    .addItem('Move from Waitlist to VR', 'moveFromWaitlistToVRSpace')
    .addItem('Mark as Notified', 'markAsNotified')
    .addItem('Mark as No Show', 'markAsNoShow')
    .addToUi();
}

// =========================
// Utility Functions
// =========================

/**
 * Generates a unique session ID based on the attendee's unique ID and current timestamp.
 * @param {string} uniqueId - The unique identifier of the attendee.
 * @returns {string} - The generated session ID.
 */

function generateSessionID(uniqueId) {
  var timestamp = new Date().getTime();
  return uniqueId + "-" + timestamp;
}
/**
 * Retrieves attendee information from the Legal sheet based on first and last name.
 * @param {string} firstName - The first name of the attendee.
 * @param {string} [lastName] - The last name of the attendee (optional).
 * @returns {Array} - An array of matching attendee objects.
 */
function getAttendeeInfo(firstName, lastName = null) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var matches = [];

  firstName = firstName.toLowerCase();
  if (lastName) lastName = lastName.toLowerCase();
   

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var sheetFirstName = data[i][3]; // Adjust column index based on your sheet
    var sheetLastName = data[i][4];  // Adjust column index based on your sheet
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

  firstName = firstName.toLowerCase();

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
    var supportedGames = data[i][1]; // Adjust column index based on your sheet
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
 * Finds available VR spaces for a selected game.
 * @param {string} game - The selected game.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @returns {Array} - An array of available VR space names.
 */
function findAvailableSpacesForGame(game, vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var availableSpaces = [];

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var vrSpace = data[i][0];           // VR Space Name
    var supportedGames = data[i][1];    // Supported Games
    var status = data[i][2];            // Status

    if (status.toString().trim().toLowerCase() === "available" && supportedGames) {
      var gamesList = supportedGames.split(',').map(function(s) { return s.trim(); });
      if (gamesList.includes(game)) {
        availableSpaces.push(vrSpace);
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
      trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Error Flag in Column S
      trackerSheet.getRange(rowToUpdate, 18).setValue(errorMessage); // Notes in Column R
      break;
    }
  }
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
    var sessionId = generateSessionID(attendee.uniqueId);
    promptForGameDropdown(attendee, sessionId);
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-in: ' + error.message);
  }
}

/**
 * Retrieves attendee information for individual check-in.
 * @returns {Object|null} - The attendee object or null if not found/cancelled.
 */
function getIndividualAttendeeInfo() {
  var ui = SpreadsheetApp.getUi();
  var firstNameResponse = ui.prompt('Individual Check-In', 'Please enter the first name of the attendee:', ui.ButtonSet.OK_CANCEL);
  
  if (firstNameResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled.');
    return null;
  }

  var firstName = firstNameResponse.getResponseText().trim().toLowerCase();
  if (!firstName) {
    ui.alert('First name is required.');
    return null;
  }

  var matches = getAttendeeInfo(firstName);
  
  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    var lastNameResponse = ui.prompt('Multiple Matches Found', 'Multiple attendees found with the first name "' + capitalize(firstName) + '". Please enter the last name:', ui.ButtonSet.OK_CANCEL);
    if (lastNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }

    var lastName = lastNameResponse.getResponseText().trim().toLowerCase();
    if (!lastName) {
      ui.alert('Last name is required.');
      return null;
    }

    matches = getAttendeeInfo(firstName, lastName);
    if (matches.length === 1) {
      // Log warning if multiple matches existed and user proceeded with first match
      if (matches.length > 1) {
        setErrorFlag(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker'), matches[0].uniqueId, 'Multiple matches found. Used first match.');
      }
      return matches[0];
    } else if (matches.length === 0) {
      ui.alert('No attendee found with that first and last name.');
      return null;
    } else {
      // Multiple matches even after providing last name, use first and log error
      setErrorFlag(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker'), matches[0].uniqueId, 'Multiple matches found. Used first match.');
      return matches[0];
    }
  }

  ui.alert('No attendee found with that first name.');
  return null;
}

/**
 * Prompts the user to select a game from available games.
 * @param {Object} attendee - The attendee object.
 * @param {string} sessionId - The generated session ID.
 */
function promptForGameDropdown(attendee, sessionId) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);
    if (supportedGames.length === 0) {
      SpreadsheetApp.getUi().alert('No supported games found.');
      return;
    }

    // Create HTML form for game selection
    var template = HtmlService.createTemplateFromFile('GameSelection');
    template.supportedGames = supportedGames;
    template.attendeeData = JSON.stringify(attendee);
    template.sessionId = sessionId;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select Game');
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error in promptForGameDropdown: ' + error.message);
  }
}

/**
 * Handles the game selection from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} sessionId - The session ID.
 */
function selectGame(selectedGame, attendeeDataJSON, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');

  var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

  if (availableSpaces.length > 0) {
    // Prompt for VR space selection
    promptForVRSpaceDropdown(availableSpaces, attendee, selectedGame, sessionId);
  } else {
    // If no spaces are available, add to waitlist
    addToWaitlist(attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('No available VR spaces for ' + selectedGame + '. Attendee added to waitlist.');
  }
}

/**
 * Prompts the user to select a VR space from available spaces.
 * @param {Array} availableSpaces - Array of available VR space names.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function promptForVRSpaceDropdown(availableSpaces, attendee, selectedGame, sessionId) {
  var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
  template.availableSpaces = availableSpaces;
  template.attendeeData = JSON.stringify(attendee).replace(/'/g, "\\'");
  template.selectedGame = selectedGame;
  template.sessionId = sessionId;
  template.callbackFunction = 'selectVRSpace'; // Ensure this is set
  var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select VR Space');
}

/**
 * Handles the VR space selection from the HTML dialog.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function selectVRSpace(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  try {
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('Attendee checked in to ' + selectedSpace + ' with game ' + selectedGame + '.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
  }
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
 * @param {string} firstName - The first name of the group member.
 * @param {string} lastName - The last name of the group member.
 * @param {string} role - The role of the group member (e.g., "Group Leader", "Group Member 2").
 * @returns {Object|null} - The attendee object or null if not found/cancelled.
 */
function verifyGroupMember(firstName, lastName, role) {
  var ui = SpreadsheetApp.getUi();
  var matches = getAttendeeInfo(firstName, lastName);

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    // Use the first match and log an error
    setErrorFlag(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker'), matches[0].uniqueId, role + ': Multiple matches found. Used first match.');
    return matches[0];
		
  }

  ui.alert('No attendee found with that first and last name for ' + role + '.');
  return null;
}

/**
 * Handles the game selection for the group from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user for the group.
 */
function selectGameGroup(selectedGame) {
  var scriptProperties = PropertiesService.getScriptProperties();
  var groupMembersJSON = scriptProperties.getProperty('groupMembers');
  var groupMembers = JSON.parse(groupMembersJSON);
  var groupSize = groupMembers.length;
  var groupNumber = generateGroupNumber();
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

  if (availableSpaces.length < groupSize) {
    // Not enough spaces for the entire group
    SpreadsheetApp.getUi().alert('Not enough VR spaces available for the group.');
      return;
    }

  // Prompt to select multiple VR spaces for the group
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers);
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
}

/**
 * Generates a unique group number based on the current timestamp.
 * @returns {number} - The generated group number.
 */
function generateGroupNumber() {
  return new Date().getTime(); // Unique group identifier
}

/**
 * Assigns VR spaces to the group members based on selected spaces.
 * @param {Array} selectedSpaces - Array of selected VR space names.
 * @param {string} selectedGame - The selected game for the group.
 * @param {number} groupNumber - The unique group number.
 * @param {string} groupMembersJSON - JSON string of group members.
 */
function assignVRSpacesToGroup(selectedSpaces, selectedGame, groupNumber, groupMembersJSON) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    var groupMembers = JSON.parse(groupMembersJSON);
    var checkInTime = new Date();

    if (selectedSpaces.length < groupMembers.length) {
      SpreadsheetApp.getUi().alert('Number of selected VR spaces is less than the number of group members.');
      return;
    }

    // Ensure no duplicate VR spaces are assigned
    var uniqueSpaces = new Set(selectedSpaces);
    if (uniqueSpaces.size !== selectedSpaces.length) {
      SpreadsheetApp.getUi().alert('Duplicate VR spaces selected. Please assign unique VR spaces to each group member.');
      return;
    }

    for (var i = 0; i < groupMembers.length; i++) {
      var attendee = groupMembers[i];
      var sessionId = generateSessionID(attendee.uniqueId || '');

      var selectedSpace = selectedSpaces[i];
      updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, attendee.isLeader, groupNumber);
      updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    }

    SpreadsheetApp.getUi().alert('Group check-in completed successfully.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during group check-in: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet for group check-in.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 * @param {boolean} isLeader - Indicates if the attendee is the group leader.
 * @param {number} groupNumber - The unique group number.
 */
function updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber) {
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var currentTime = new Date();

  // Calculate Visit Count
  var data = trackerSheet.getDataRange().getValues();
  var visitCount = 1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === attendee.uniqueId) {
      var previousVisitCount = data[i][16];
      if (previousVisitCount && !isNaN(previousVisitCount)) {
        visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
      }
    }
  }

  trackerSheet.appendRow([
    sessionId,                     // Column A: Session ID
    attendee.uniqueId || '',       // Column B: Unique ID
    attendee.firstName,            // Column C: First Name
    attendee.lastName || '',       // Column D: Last Name
    fullName,                      // Column E: Full Name
    isLeader ? attendee.firstName : "", // Column F: Group Leader
    groupNumber,                   // Column G: Group No.
    "",                            // Column H: WL Time
    currentTime,                   // Column I: Check-In Time
    "",                            // Column J: Check-Out Time
    "",                            // Column K: Waitlist Duration
    "",                            // Column L: Session Duration
    "",                            // Column M: Total Duration
    selectedGame,                  // Column N: Game
    selectedSpace,                 // Column O: VR Space
    "Active",                      // Column P: Session Status
    visitCount,                    // Column Q: Visit Count
    "",                            // Column R: Notes
    "",                            // Column S: Error Flag
    ""                             // Column T: No Show
  ]);
}



// =========================
// Update Functions
// =========================

/**
 * Updates the Tracker sheet for individual check-in or waitlist addition.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space (empty if waitlisted).
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 * @param {boolean} isFromWaitlist - Indicates if the check-in is from the waitlist.
 */
function updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isFromWaitlist) {
  var data = trackerSheet.getDataRange().getValues();
  var trackerRowToUpdate = -1;

  // Check if the Session ID already exists
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      trackerRowToUpdate = i + 1;
      break;
    }
  }

  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var currentTime = new Date();

  if (trackerRowToUpdate !== -1) {
    // Update existing row
    trackerSheet.getRange(trackerRowToUpdate, 9).setValue(currentTime); // Check-In Time
    trackerSheet.getRange(trackerRowToUpdate, 14).setValue(selectedGame); // Game
    trackerSheet.getRange(trackerRowToUpdate, 15).setValue(selectedSpace); // VR Space
    trackerSheet.getRange(trackerRowToUpdate, 16).setValue("Active"); // Session Status

    // Update Visit Count
    var previousVisitCount = data[trackerRowToUpdate - 1][16];
    var visitCount = previousVisitCount ? parseInt(previousVisitCount) + 1 : 1;
    trackerSheet.getRange(trackerRowToUpdate, 17).setValue(visitCount);

  } else {
    // Calculate Visit Count
    var visitCount = 1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === attendee.uniqueId) {
        var previousVisitCount = data[i][16];
        if (previousVisitCount && !isNaN(previousVisitCount)) {
          visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
        }
      }
    }

    trackerSheet.appendRow([
      sessionId,
      attendee.uniqueId || '',
      attendee.firstName,
      attendee.lastName || '',
      fullName,
      isFromWaitlist ? "" : attendee.firstName, // Group Leader
      "", // Group No.
      isFromWaitlist ? currentTime : "", // WL Time
      isFromWaitlist ? "" : currentTime, // Check-In Time
      "", // Check-Out Time
      "", // Waitlist Duration
      "", // Session Duration
      "", // Total Duration
      selectedGame,
      selectedSpace,
      isFromWaitlist ? "Waiting" : "Active",
      visitCount,
      "", // Notes
      "", // Error Flag
      ""  // No Show
    ]);
  }
}

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

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSpace) { // Column A: VR Space
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate !== -1) {
    vrSheet.getRange(rowToUpdate, 3).setValue("Occupied"); // Column C: Status
    vrSheet.getRange(rowToUpdate, 4).setValue(attendee.firstName); // Column D: FName
    vrSheet.getRange(rowToUpdate, 5).setValue(selectedGame); // Column E: Game
    vrSheet.getRange(rowToUpdate, 6).setValue(sessionId); // Column F: Session ID
    vrSheet.getRange(rowToUpdate, 7).setValue(new Date()); // Column G: Check-In Time
    // Column H: Duration remains untouched
  } else {
    throw new Error("VR Space not found: " + selectedSpace);
  }
}

// =========================
// Group Check-In Functions
// =========================

/**
 * Handles the group check-in process.
 * Verifies each group member and assigns VR spaces.
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
      ui.alert('Not enough VR spaces available for the group.');
      return;
    }

    // Prompt to select multiple VR spaces
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers);
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}

// =========================
// Check-Out Functions
// =========================

/**
 * Initiates the check-out process by listing occupied VR spaces.
 */
function checkOut() {
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
 * Processes the check-out for selected VR spaces.
 * @param {Array} selectedSpaces - Array of selected VR space names.
 */
function processCheckOut(selectedSpaces) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    var checkOutTime = new Date();

    for (var i = 0; i < selectedSpaces.length; i++) {
      var selectedSpace = selectedSpaces[i];
      updateCheckOutTracker(trackerSheet, selectedSpace, checkOutTime);
      freeVRSpace(vrSheet, selectedSpace);
    }

    SpreadsheetApp.getUi().alert('Selected attendees have been checked out.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-out: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet upon check-out.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} space - The VR space being checked out.
 * @param {Date} checkOutTime - The check-out time.
 */

function updateCheckOutTracker(trackerSheet, space, checkOutTime) {
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][14].toString().trim().toLowerCase() === space.toLowerCase() && !data[i][9]) { // Column O: VR Space, Column J: Check-Out Time
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate === -1) {
    throw new Error('No active session found for VR Space: ' + space);
  }

  trackerSheet.getRange(rowToUpdate, 10).setValue(checkOutTime); // Column J: Check-Out Time

  var checkInTime = data[rowToUpdate - 1][8];
  var wlTime = data[rowToUpdate - 1][7];

  if (checkInTime instanceof Date) {
    var sessionDuration = (checkOutTime - checkInTime) / (1000 * 60); // Duration in minutes
    trackerSheet.getRange(rowToUpdate, 12).setValue(sessionDuration); // Column L: Session Duration
  } else {
    trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Column S: Error Flag
    trackerSheet.getRange(rowToUpdate, 18).setValue('Invalid Check-In Time'); // Column R: Notes
  }

  if (wlTime instanceof Date) {
    var waitlistDuration = (checkInTime - wlTime) / (1000 * 60); // Duration in minutes
    trackerSheet.getRange(rowToUpdate, 11).setValue(waitlistDuration); // Column K: Waitlist Duration

    var totalDuration = (checkOutTime - wlTime) / (1000 * 60); // Duration in minutes
    trackerSheet.getRange(rowToUpdate, 13).setValue(totalDuration); // Column M: Total Duration
  } else {
    trackerSheet.getRange(rowToUpdate, 13).setValue(sessionDuration); // Column M: Total Duration
  }

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
    if (data[i][0].toString().trim() === space) { // Column A: VR Space
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
       

  var response = ui.alert('Add to Waitlist', promptMessage, ui.ButtonSet.YES_NO_CANCEL);

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
  waitlistSheet.appendRow([
    sessionId,            // Column A: SessionID
    attendee.firstName,   // Column B: FName
    phoneNumber,          // Column C: Phone Number
    selectedGame,         // Column D: Game
    wlTime,               // Column E: WL Time
    "",                   // Column F: Time Notified
    "",                   // Column G: Time Since Added
    "",                   // Column H: Time Since Notified
    ""                    // Column I: Group No.
  ]);

  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  updateCheckInTracker(trackerSheet, attendee, "", selectedGame, sessionId, true);

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
}

/**
 * Processes moving an attendee from the waitlist to a VR space.
 * @param {string} selectedSessionId - The session ID of the attendee selected from the waitlist.
 */
function processMoveFromWaitlist(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

  // Find the waitlist entry
  var waitlistData = waitlistSheet.getDataRange().getValues();
  var selectedEntry = null;

  for (var i = 1; i < waitlistData.length; i++) {
    if (waitlistData[i][0].toString().trim() === selectedSessionId) { // Column A: SessionID
      selectedEntry = {
        sessionId: waitlistData[i][0],       // Column A: SessionID
        firstName: waitlistData[i][1],       // Column B: FName
        phoneNumber: waitlistData[i][2],     // Column C: Phone Number
        game: waitlistData[i][3],            // Column D: Game
        wlTime: waitlistData[i][4],          // Column E: WL Time
        rowIndex: i + 1
      };
      break;
    }
  }

  if (!selectedEntry) {
    ui.alert('Attendee not found on the waitlist.');
    return;
  }

  // Find available spaces for the attendee's game
  var availableSpaces = findAvailableSpacesForGame(selectedEntry.game, vrSheet);

  if (availableSpaces.length === 0) {
    ui.alert("No available VR spaces for the game: " + selectedEntry.game);
    return;
  }

  // Prompt for VR space selection
  var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
  template.availableSpaces = availableSpaces;
  template.attendeeData = JSON.stringify({
    uniqueId: '', // Adjust if uniqueId is stored elsewhere
    firstName: selectedEntry.firstName,
    lastName: '', // Adjust if last name is available
    phoneNumber: selectedEntry.phoneNumber
  }).replace(/'/g, "\\'");
  template.selectedGame = selectedEntry.game;
  template.sessionId = selectedEntry.sessionId;
  template.callbackFunction = 'finalizeMoveFromWaitlist';

  var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Space');
}

/**
 * Finalizes the move of an attendee from the waitlist to a VR space.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function finalizeMoveFromWaitlist(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);

  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');

  try {
  updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
  updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
  removeFromWaitlist(waitlistSheet, sessionId);

  SpreadsheetApp.getUi().alert('Attendee assigned to ' + selectedSpace + ' with game ' + selectedGame + '.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
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
    entries.push({
      sessionId: data[i][0].toString().trim(),   // Column A: SessionID
      firstName: data[i][1].toString().trim(),   // Column B: FName
      phoneNumber: data[i][2].toString().trim(), // Column C: Phone Number
      game: data[i][3].toString().trim(),        // Column D: Game
      wlTime: data[i][4],                         // Column E: WL Time
      rowIndex: i + 1
    });
  }
  return entries;
}
/**
 * Removes an attendee from the waitlist based on session ID.
 * @param {Sheet} waitlistSheet - The Waitlist sheet.
 * @param {string} sessionId - The session ID to remove.
 */
function removeFromWaitlist(waitlistSheet, sessionId) {
  var data = waitlistSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === sessionId) {
      waitlistSheet.deleteRow(i + 1);
      break;
    }
  }
}

// =========================
// Mark as Notified Functions
// =========================

/**
 * Initiates the process to mark an attendee on the waitlist as notified.
 */
function markAsNotified() {
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
}

/**
 * Processes marking an attendee as notified.
 * @param {string} selectedSessionId - The session ID of the attendee to mark as notified.
 */

function processMarkAsNotified(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var data = waitlistSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === selectedSessionId) { // Column A: SessionID
      waitlistSheet.getRange(i + 1, 6).setValue(new Date()); // Column F: Time Notified
      ui.alert('Attendee has been marked as notified.');
      return;
    }
  }

  ui.alert('Attendee not found on the waitlist.');
}


// =========================
// Mark as No Show Functions
// =========================

/**
 * Initiates the process to mark an attendee as a no-show.
 */
function markAsNoShow() {
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var data = trackerSheet.getDataRange().getValues();
  var waitingAttendees = [];

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    if (data[i][15].toString().trim().toLowerCase() === "waiting") { // Column P: Session Status
      waitingAttendees.push({
        sessionId: data[i][0].toString().trim(),     // Column A: Session ID
        firstName: data[i][2].toString().trim(),     // Column C: First Name
        lastName: data[i][3].toString().trim()       // Column D: Last Name
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
}

/**
 * Processes marking an attendee as a no-show.
 * @param {string} selectedSessionId - The session ID of the attendee to mark as no-show.
 */
function processMarkAsNoShow(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === selectedSessionId && data[i][15].toString().trim().toLowerCase() === "waiting") { // Column A and P
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
}

// =========================
// Helper Functions
// =========================

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} - The capitalized string.
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}