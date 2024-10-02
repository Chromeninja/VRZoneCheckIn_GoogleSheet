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
  var lastRow = legalSheet.getLastRow();
  if (lastRow < 2) return []; // No data

  // Fetch data from all relevant columns (A to Q)
  var dataRange = legalSheet.getRange(2, 1, lastRow - 1, 17); // Rows 2 to lastRow, Columns A (1) to Q (17)
  var data = dataRange.getValues();

  var matches = [];

  firstName = firstName.toLowerCase().trim();
  if (lastName) lastName = lastName.toLowerCase().trim();

  for (var i = 0; i < data.length; i++) { // Start from first data row
    var sheetFirstName = data[i][3]; // Column D: Index 3
    var sheetLastName = data[i][4];  // Column E: Index 4
    if (!sheetFirstName) continue;

    if (sheetFirstName.toString().trim().toLowerCase() === firstName) {
      if (lastName) {
        if (sheetLastName && sheetLastName.toString().trim().toLowerCase() === lastName) {
          matches.push({
            uniqueId: data[i][16], // Column Q: Index 16
            firstName: data[i][3], // Column D: Index 3
            lastName: data[i][4],  // Column E: Index 4
            phoneNumber: data[i][13], // Column N: Index 13
          });
        }
      } else {
        matches.push({
          uniqueId: data[i][16], // Column Q: Index 16
          firstName: data[i][3], // Column D: Index 3
          lastName: data[i][4],  // Column E: Index 4
          phoneNumber: data[i][13], // Column N: Index 13
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
  var lastRow = legalSheet.getLastRow();
  if (lastRow < 2) return false; // No data

  // Read only the First Name column (Column D: Index 3)
  var firstNameRange = legalSheet.getRange(2, 4, lastRow - 1, 1); // Column D
  var firstNameData = firstNameRange.getValues();

  var count = 0;
  firstName = firstName.toLowerCase().trim();

  for (var i = 0; i < firstNameData.length; i++) {
    var legalFirstName = firstNameData[i][0];
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
  var lastRow = vrSheet.getLastRow();
  if (lastRow < 2) return []; // No data

  // Read only the Supported Games column (Column B: Index 2)
  var supportedGamesRange = vrSheet.getRange(2, 2, lastRow - 1, 1); // Column B
  var supportedGamesData = supportedGamesRange.getValues();

  var supportedGamesSet = new Set();
  for (var i = 0; i < supportedGamesData.length; i++) {
    var supportedGames = supportedGamesData[i][0];
    if (supportedGames) {
      supportedGames.split(',').forEach(function(game) {
        supportedGamesSet.add(game.trim());
      });
    }
  }

  return Array.from(supportedGamesSet);
}

/**
 * Finds available VR spaces that support the selected game.
 * @param {string} selectedGame - The game for which VR spaces are being searched.
 * @param {Sheet} vrSheet - The sheet containing VR spaces and their statuses.
 * @returns {Array} - An array of available spaces for the selected game.
 */
function findAvailableSpacesForGame(selectedGame, vrSheet) {
  var lastRow = vrSheet.getLastRow();
  if (lastRow < 2) return []; // No data

  // Read only Columns A to C (VR Space, Supported Games, Status)
  var dataRange = vrSheet.getRange(2, 1, lastRow - 1, 3); // Columns A, B, C
  var data = dataRange.getValues();
  var availableSpaces = [];

  var normalizedSelectedGame = selectedGame.trim().toLowerCase();

  for (var i = 0; i < data.length; i++) {
    var vrSpace = data[i][0];            // Column A: VR Space
    var supportedGames = data[i][1];     // Column B: Supported Games
    var status = data[i][2];             // Column C: Status

    if (status === 'Available' && supportedGames) {
      var supportedGamesArray = supportedGames.split(',').map(function(game) {
        return game.trim().toLowerCase();
      });

      if (supportedGamesArray.includes(normalizedSelectedGame)) {
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
  var lastRow = trackerSheet.getLastRow();
  if (lastRow < 2) return; // No data

  // Read only the Session ID column (Column A: Index 0)
  var sessionIdRange = trackerSheet.getRange(2, 1, lastRow - 1, 1); // Column A
  var sessionIds = sessionIdRange.getValues();

  var rowToUpdate = -1;

  for (var i = 0; i < sessionIds.length; i++) {
    if (sessionIds[i][0] === sessionId) {
      rowToUpdate = i + 2; // Adjust for header row
      break;
    }
  }

  if (rowToUpdate !== -1) {
    // Batch write: Set Error Flag and Notes in one operation
    trackerSheet.getRange(rowToUpdate, 18, 1, 2).setValues([[errorMessage, true]]);
    // Note: Columns R (18) and S (19). Adjusted to R and S.
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

  // Load attendee data from cache or sheet
  var attendeeData = getCachedAttendeeData();

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

    matches = findAttendeesByFirstName(attendeeData, firstName);

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

        matches = findAttendeesByFullName(attendeeData, firstName, lastName);

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
    var supportedGames = getCachedSupportedGames();
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

function getCachedSupportedGames() {
  var cache = CacheService.getScriptCache();
  var cachedGames = cache.get('supportedGames');
  if (cachedGames) {
    return JSON.parse(cachedGames);
  } else {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);
    cache.put('supportedGames', JSON.stringify(supportedGames), 300); // Cache for 5 minutes
    return supportedGames;
  }
}

/**
 * Handles the game selection from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} sessionId - The session ID.
 */
function selectGame(selectedGame, sessionId) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    // Retrieve attendee data from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var attendeeDataJSON = scriptProperties.getProperty('attendee_' + sessionId);
    var attendee = JSON.parse(attendeeDataJSON);
    scriptProperties.deleteProperty('attendee_' + sessionId); // Clean up

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');

    var availableSpaces = findAvailableSpacesForGameCached(selectedGame);

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
  } finally {
    lock.releaseLock();
  }
}

function findAvailableSpacesForGameCached(selectedGame) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'availableSpaces_' + selectedGame;
  var cachedSpaces = cache.get(cacheKey);
  
  if (cachedSpaces) {
    try {
      return JSON.parse(cachedSpaces);
    } catch (e) {
      // If parsing fails, invalidate the cache and fetch fresh data
      cache.remove(cacheKey);
      Logger.log('Cache parsing error for key ' + cacheKey + ': ' + e.message);
    }
  }
  
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);
    cache.put(cacheKey, JSON.stringify(availableSpaces), 300); // Cache for 5 minutes
    return availableSpaces;
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error fetching available spaces: ' + error.message);
    return [];
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
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    // Retrieve attendee data from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var attendeeDataJSON = scriptProperties.getProperty('attendee_' + sessionId);
    var attendee = JSON.parse(attendeeDataJSON);
    scriptProperties.deleteProperty('attendee_' + sessionId); // Clean up

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // The attendee is checked in, not waitlisted
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('Attendee checked in to ' + selectedSpace + ' with game ' + selectedGame + '.');

    // Invalidate the cache for the selected game
    invalidateAvailableSpacesCache(selectedGame);
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

function invalidateAvailableSpacesCache(selectedGame) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'availableSpaces_' + selectedGame;
  cache.remove(cacheKey);
}

/**
 * Updates the Tracker sheet for individual check-in and waitlist.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space or 'Waitlist'.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The unique session ID for this attendee.
 * @param {boolean} isWaitlisted - Indicates if the attendee is added to the waitlist.
 */
function updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isWaitlisted) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var dataRange = trackerSheet.getDataRange();
    var data = dataRange.getValues();

    var rowToUpdate = -1;
    var currentTime = new Date();
    var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
    var visitCount = getVisitCount(trackerSheet, attendee.uniqueId);

    // Define column indices (1-based indexing)
    var colSessionId = 1; // Column A
    var colUniqueId = 2;  // Column B
    var colFirstName = 3; // Column C
    var colLastName = 4;  // Column D
    var colFullName = 5;  // Column E
    var colWaitlistTime = 8; // Column H
    var colCheckInTime = 9;  // Column I
    var colCheckOutTime = 10; // Column J
    var colWaitlistDuration = 11; // Column K
    var colSessionDuration = 12; // Column L
    var colTotalDuration = 13; // Column M
    var colGame = 14; // Column N
    var colVRSpace = 15; // Column O
    var colSessionStatus = 16; // Column P
    var colVisitCount = 17; // Column Q

    // Search for existing session ID
    for (var i = 1; i < data.length; i++) {
      if (data[i][colSessionId - 1] === sessionId) {
        rowToUpdate = i + 1; // Adjust for header row
        break;
      }
    }

    if (rowToUpdate === -1) {
      // Append new row
      var newRow = [];
      newRow[colSessionId - 1] = sessionId;
      newRow[colUniqueId - 1] = attendee.uniqueId || '';
      newRow[colFirstName - 1] = attendee.firstName;
      newRow[colLastName - 1] = attendee.lastName || '';
      newRow[colFullName - 1] = fullName;
      // Columns F (Group Leader) and G (Group Number) can be left empty
      newRow[colGame - 1] = selectedGame;
      newRow[colVRSpace - 1] = selectedSpace;
      newRow[colSessionStatus - 1] = isWaitlisted ? 'Waiting' : 'Active';
      newRow[colVisitCount - 1] = visitCount;

      if (isWaitlisted) {
        newRow[colWaitlistTime - 1] = currentTime;
      } else {
        newRow[colCheckInTime - 1] = currentTime;
      }

      trackerSheet.appendRow(newRow);
      rowToUpdate = trackerSheet.getLastRow();
    } else {
      // Update existing row
      var updateRange = trackerSheet.getRange(rowToUpdate, 1, 1, trackerSheet.getLastColumn());
      var rowData = updateRange.getValues()[0];

      if (isWaitlisted) {
        rowData[colWaitlistTime - 1] = currentTime;
        rowData[colSessionStatus - 1] = 'Waiting';
        rowData[colVRSpace - 1] = 'Waitlist';
      } else {
        rowData[colCheckInTime - 1] = currentTime;
        rowData[colSessionStatus - 1] = 'Active';
        rowData[colVRSpace - 1] = selectedSpace;
      }

      rowData[colGame - 1] = selectedGame;
      rowData[colVisitCount - 1] = visitCount;

      updateRange.setValues([rowData]);
    }

    // Update durations
    updateDurations(trackerSheet, rowToUpdate);

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while updating the Tracker: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates the durations in the Tracker sheet.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {number} row - The row number to update.
 */
function updateDurations(trackerSheet, row) {
  var now = new Date();
  var waitlistTime = trackerSheet.getRange(row, 8).getValue(); // Column H
  var checkInTime = trackerSheet.getRange(row, 9).getValue();  // Column I
  var checkOutTime = trackerSheet.getRange(row, 10).getValue(); // Column J

  var waitlistDuration = waitlistTime ? ((checkInTime || now) - waitlistTime) / 1000 / 60 : 'N/A'; // In minutes
  var sessionDuration = checkInTime ? ((checkOutTime || now) - checkInTime) / 1000 / 60 : 'N/A';  // In minutes
  var totalDuration = waitlistDuration !== 'N/A' && sessionDuration !== 'N/A' ? waitlistDuration + sessionDuration :
                      waitlistDuration !== 'N/A' ? waitlistDuration :
                      sessionDuration !== 'N/A' ? sessionDuration : 'N/A';

  trackerSheet.getRange(row, 11).setValue(waitlistDuration); // Column K
  trackerSheet.getRange(row, 12).setValue(sessionDuration);  // Column L
  trackerSheet.getRange(row, 13).setValue(totalDuration);    // Column M
}

/**
 * Retrieves the visit count for an attendee based on Unique ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} uniqueId - The Unique ID of the attendee.
 * @returns {number} - The updated visit count.
 */
function getVisitCount(trackerSheet, uniqueId) {
  var dataRange = trackerSheet.getRange('B2:B'); // Column B: Unique ID
  var data = dataRange.getValues();
  var visitCount = 0;

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === uniqueId) {
      visitCount++;
    }
  }
  return visitCount + 1; // Adding 1 for the current visit
}

function getCachedAttendeeData() {
  var cache = CacheService.getScriptCache();
  var cachedData = cache.get('attendeeData');
  if (cachedData) {
    return JSON.parse(cachedData);
  } else {
    var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
    var lastRow = legalSheet.getLastRow();
    if (lastRow < 2) return []; // No data

    var dataRange = legalSheet.getRange(2, 1, lastRow - 1, 17);
    var data = dataRange.getValues();

    var attendeeData = data.map(function(row) {
      return {
        uniqueId: row[16],
        firstName: row[3] ? row[3].toLowerCase().trim() : '',
        lastName: row[4] ? row[4].toLowerCase().trim() : '',
        phoneNumber: row[13]
      };
    });

    cache.put('attendeeData', JSON.stringify(attendeeData), 300); // Cache for 5 minutes
    return attendeeData;
  }
}

function findAttendeesByFirstName(attendeeData, firstName) {
  return attendeeData.filter(function(attendee) {
    return attendee.firstName === firstName;
  });
}

function findAttendeesByFullName(attendeeData, firstName, lastName) {
  return attendeeData.filter(function(attendee) {
    return attendee.firstName === firstName && attendee.lastName === lastName;
  });
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
    // Step 1: Collect Group Information
    var groupInfo = collectGroupInformation();
    if (!groupInfo) return;

    // Step 2: Verify Group Members
    var groupMembers = verifyGroupMembers(groupInfo);
    if (!groupMembers) return;

    // Step 3: Store group data
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('groupMembers', JSON.stringify(groupMembers));

    // Step 4: Prompt for Game Selection
    promptForGroupGameSelection();

  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}

function collectGroupInformation() {
  var ui = SpreadsheetApp.getUi();
  // Prompt for the number of people in the group
  var groupSizeResponse = ui.prompt('Group Check-In', 'Enter the number of people in the group:', ui.ButtonSet.OK_CANCEL);
  if (groupSizeResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled.');
    return null;
  }
  var groupSize = parseInt(groupSizeResponse.getResponseText());
  if (isNaN(groupSize) || groupSize <= 0) {
    ui.alert('Invalid group size.');
    return null;
  }

  // Prompt for the group leader's first name
  var groupLeaderFirstNameResponse = ui.prompt('Group Check-In', 'Enter the first name of the group leader:', ui.ButtonSet.OK_CANCEL);
  if (groupLeaderFirstNameResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled.');
    return null;
  }
  var groupLeaderFirstName = groupLeaderFirstNameResponse.getResponseText().trim();
  if (!groupLeaderFirstName) {
    ui.alert('Group leader\'s first name is required.');
    return null;
  }

  return {
    groupSize: groupSize,
    groupLeaderFirstName: groupLeaderFirstName
  };
}

function verifyGroupMembers(groupInfo) {
  var ui = SpreadsheetApp.getUi();
  var groupMembers = [];
  var attendeeData = getCachedAttendeeData();
  var groupSize = groupInfo.groupSize;
  var groupLeaderFirstName = groupInfo.groupLeaderFirstName;

  // Verify group leader
  var groupLeader = verifyGroupMember(groupLeaderFirstName, 'Group Leader', attendeeData);
  if (!groupLeader) return null;
  groupMembers.push(groupLeader);

  // Collect and verify each group member's information
  for (var i = 2; i <= groupSize; i++) {
    var memberFirstNameResponse = ui.prompt('Group Check-In', 'Enter the first name of group member ' + i + ':', ui.ButtonSet.OK_CANCEL);
    if (memberFirstNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }
    var memberFirstName = memberFirstNameResponse.getResponseText().trim();
    if (!memberFirstName) {
      ui.alert('Group member ' + i + '\'s first name is required.');
      return null;
    }

    var groupMember = verifyGroupMember(memberFirstName, 'Group Member ' + i, attendeeData);
    if (!groupMember) return null;
    groupMembers.push(groupMember);
  }

  return groupMembers;
}

function promptForGroupGameSelection() {
  var ui = SpreadsheetApp.getUi();
  var supportedGames = getCachedSupportedGames();
  if (supportedGames.length === 0) {
    ui.alert('No supported games found.');
    return;
  }

  var template = HtmlService.createTemplateFromFile('GameSelectionGroup');
  template.supportedGames = supportedGames;

  var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
  ui.showModalDialog(htmlOutput, 'Select Game for Group');
}

function finalizeGroupCheckIn(selectedSpaces, groupMembersJSON, selectedGame, groupNumber) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var groupMembers = JSON.parse(groupMembersJSON);
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // Ensure selectedSpaces length matches groupMembers length
    if (selectedSpaces.length !== groupMembers.length) {
      SpreadsheetApp.getUi().alert('Error: The number of selected VR spaces does not match the number of group members.');
      return;
    }

    // Prepare batch updates
    var vrUpdates = [];
    var trackerUpdates = [];

    groupMembers.forEach(function(attendee, index) {
      var selectedSpace = selectedSpaces[index];
      var isLeader = (index === 0);

      // Update Tracker
      var trackerRow = prepareTrackerRowForGroup(attendee, selectedSpace, selectedGame, attendee.sessionId, isLeader, groupNumber, groupMembers[0]);
      trackerUpdates.push(trackerRow);

      // Update VRSpaces
      var vrRow = prepareVRSpacesRow(selectedSpace, attendee, selectedGame, attendee.sessionId);
      vrUpdates.push({ space: selectedSpace, data: vrRow });
    });

    // Apply batch updates to Tracker
    appendRowsToSheet(trackerSheet, trackerUpdates);

    // Apply batch updates to VRSpaces
    updateVRSpacesBatch(vrSheet, vrUpdates);

    // Invalidate caches
    invalidateAvailableSpacesCache(selectedGame);

    SpreadsheetApp.getUi().alert('Group check-in completed successfully.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during group check-in: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

function prepareTrackerRowForGroup(attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber, groupLeader) {
  var currentTime = new Date();
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var groupLeaderFullName = groupLeader.firstName + ' ' + (groupLeader.lastName || '');
  var visitCount = 1; // Simplified for batch processing; update if necessary

  return [
    sessionId,
    attendee.uniqueId || '',
    attendee.firstName,
    attendee.lastName || '',
    fullName,
    groupLeaderFullName,
    groupNumber || '',
    '', // Waitlist Time
    currentTime, // Check-In Time
    '', // Check-Out Time
    '', // Waitlist Duration
    '', // Session Duration
    '', // Total Duration
    selectedGame,
    selectedSpace,
    'Active', // Session Status
    visitCount,
    '', // Notes
    '', // Error Flag
    '', // No Show
  ];
}

function appendRowsToSheet(sheet, rowsData) {
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
}

function prepareVRSpacesRow(selectedSpace, attendee, selectedGame, sessionId) {
  var currentTime = new Date();
  return [
    'Occupied',
    attendee.firstName,
    selectedGame,
    sessionId,
    currentTime
  ];
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
function verifyGroupMember(firstName, role, attendeeData) {
  var ui = SpreadsheetApp.getUi();
  var lastName = '';
  var matches = findAttendeesByFirstName(attendeeData, firstName.toLowerCase());

  while (matches.length === 0) {
    var retryResponse = ui.prompt(role, 'No attendee found with the first name "' + capitalize(firstName) + '". Please try again or click Cancel to exit.', ui.ButtonSet.OK_CANCEL);
    if (retryResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }
    firstName = retryResponse.getResponseText().trim();
    if (!firstName) {
      ui.alert('First name is required.');
      continue;
    }
    matches = findAttendeesByFirstName(attendeeData, firstName.toLowerCase());
  }

  if (matches.length > 1) {
    var lastNameResponse = ui.prompt(role, 'Multiple attendees found with the first name "' + capitalize(firstName) + '". Please enter the last name:', ui.ButtonSet.OK_CANCEL);
    if (lastNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }
    lastName = lastNameResponse.getResponseText().trim().toLowerCase();
    if (!lastName) {
      ui.alert('Last name is required.');
      return null;
    }
    matches = findAttendeesByFullName(attendeeData, firstName.toLowerCase(), lastName);
  }

  if (matches.length === 1) {
    return matches[0];
  } else if (matches.length > 1) {
    ui.alert('Multiple matches found for ' + role + '. Using the first match.');
    return matches[0];
  } else {
    ui.alert('No attendee found for ' + role + ' with the provided names.');
    return null;
  }
}

/**
 * Handles the game selection for the group from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user for the group.
 */
function selectGameGroup(selectedGame) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var scriptProperties = PropertiesService.getScriptProperties();
    var groupMembersJSON = scriptProperties.getProperty('groupMembers');

    if (!groupMembersJSON) {
      SpreadsheetApp.getUi().alert('Error: Group member data not found.');
      return;
    }

    var groupMembers = JSON.parse(groupMembersJSON);
    var groupSize = groupMembers.length;
    var groupNumber = generateGroupNumber();

    var availableSpaces = findAvailableSpacesForGameCached(selectedGame);

    if (availableSpaces.length < groupSize) {
      // Not enough spaces for the entire group
      promptForGroupWaitlist(groupMembers, selectedGame, groupNumber);
      return;
    }

    // Generate session IDs for each group member
    groupMembers.forEach(function(member) {
      member.sessionId = generateSessionId(member.uniqueId || '');
    });

    // Proceed with VR space selection
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers).replace(/'/g, "\\'");
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;
    template.callbackFunction = 'finalizeGroupCheckIn';

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred in selectGameGroup: ' + error.message);
  } finally {
    lock.releaseLock();
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
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    // Define isWaitlisted based on selectedSpace
    var isWaitlisted = selectedSpace === 'Waitlist';

    var dataRange = trackerSheet.getDataRange();
    var data = dataRange.getValues();

    var rowToUpdate = -1;
    var currentTime = new Date();
    var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
    var groupLeaderFullName = groupLeader.firstName + ' ' + (groupLeader.lastName || '');
    var visitCount = getVisitCount(trackerSheet, attendee.uniqueId);

    // Define column indices (1-based indexing)
    var colSessionId = 1; // Column A
    var colUniqueId = 2;  // Column B
    var colFirstName = 3; // Column C
    var colLastName = 4;  // Column D
    var colFullName = 5;  // Column E
    var colGroupLeader = 6; // Column F
    var colGroupNumber = 7; // Column G
    var colWaitlistTime = 8; // Column H
    var colCheckInTime = 9;  // Column I
    var colCheckOutTime = 10; // Column J
    var colWaitlistDuration = 11; // Column K
    var colSessionDuration = 12; // Column L
    var colTotalDuration = 13; // Column M
    var colGame = 14; // Column N
    var colVRSpace = 15; // Column O
    var colSessionStatus = 16; // Column P
    var colVisitCount = 17; // Column Q

    // Search for existing session ID
    for (var i = 1; i < data.length; i++) {
      if (data[i][colSessionId - 1] === sessionId) {
        rowToUpdate = i + 1; // Adjust for header row
        break;
      }
    }

    if (rowToUpdate === -1) {
      // Append new row
      var newRow = [];
      newRow[colSessionId - 1] = sessionId;
      newRow[colUniqueId - 1] = attendee.uniqueId || '';
      newRow[colFirstName - 1] = attendee.firstName;
      newRow[colLastName - 1] = attendee.lastName || '';
      newRow[colFullName - 1] = fullName;
      newRow[colGroupLeader - 1] = groupLeaderFullName;
      newRow[colGroupNumber - 1] = groupNumber || '';
      newRow[colGame - 1] = selectedGame;
      newRow[colVRSpace - 1] = selectedSpace;
      newRow[colSessionStatus - 1] = isWaitlisted ? 'Waiting' : 'Active';
      newRow[colVisitCount - 1] = visitCount;

      if (isWaitlisted) {
        newRow[colWaitlistTime - 1] = currentTime;
      } else {
        newRow[colCheckInTime - 1] = currentTime;
      }

      trackerSheet.appendRow(newRow);
      rowToUpdate = trackerSheet.getLastRow();
    } else {
      // Update existing row
      var updateRange = trackerSheet.getRange(rowToUpdate, 1, 1, trackerSheet.getLastColumn());
      var rowData = updateRange.getValues()[0];

      if (isWaitlisted) {
        rowData[colWaitlistTime - 1] = currentTime;
        rowData[colSessionStatus - 1] = 'Waiting';
        rowData[colVRSpace - 1] = 'Waitlist';
      } else {
        rowData[colCheckInTime - 1] = currentTime;
        rowData[colSessionStatus - 1] = 'Active';
        rowData[colVRSpace - 1] = selectedSpace;
      }

      rowData[colGame - 1] = selectedGame;
      rowData[colVisitCount - 1] = visitCount;

      updateRange.setValues([rowData]);
    }

    // Update durations
    updateDurations(trackerSheet, rowToUpdate);

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while updating the Tracker for group check-in: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Adds a group to the waitlist.
 * @param {Array} groupMembers - Array of group members.
 * @param {string} selectedGame - The selected game for the group.
 * @param {number} groupNumber - Unique group number for the group.
 * @param {string} phoneNumber - Group leader's phone number for notifications.
 */
function addGroupToWaitlist(groupMembers, selectedGame, groupNumber, phoneNumber) {
  // Acquire a document lock to prevent concurrent modifications
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    // Access the necessary sheets
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var waitlistSheet = spreadsheet.getSheetByName('Waitlist');
    var trackerSheet = spreadsheet.getSheetByName('Tracker');
    var checkInTime = new Date();

    // Generate session IDs for each group member
    groupMembers.forEach(function(member) {
      var sessionId = generateSessionId(member.uniqueId || '');
      member.sessionId = sessionId; // Store sessionId in the member object
    });

    // Prepare data to append to the Waitlist sheet
    var entries = [];
    groupMembers.forEach(function(member, index) {
      var sessionId = member.sessionId;
      var isLeader = (index === 0); // First member is the group leader

      entries.push([
        sessionId,                          // Column A: Session ID
        groupNumber,                        // Column B: Group Number
        groupMembers[0].firstName,          // Column C: Group Leader
        member.firstName,                   // Column D: FName
        phoneNumber,                        // Column E: Phone Number
        selectedGame,                       // Column F: Game
        checkInTime,                        // Column G: WL Time
        "",                                 // Column H: Time Notified
        `=NOW()-G${waitlistSheet.getLastRow() + 1 + index}`, // Column I: Time Since Added
        `=IF(H${waitlistSheet.getLastRow() + 1 + index}="", "", NOW()-H${waitlistSheet.getLastRow() + 1 + index})` // Column J: Time Since Notified
      ]);

      // Update the Tracker sheet for each member
      updateCheckInTrackerGroup(
        trackerSheet,
        member,
        'Waitlist',
        selectedGame,
        sessionId,
        isLeader,
        groupNumber,
        groupMembers[0]
      );
    });

    // Append all group members to the Waitlist sheet in a single operation
    if (entries.length > 0) {
      waitlistSheet
        .getRange(waitlistSheet.getLastRow() + 1, 1, entries.length, entries[0].length)
        .setValues(entries);
    }

    // Notify the user of successful addition
    SpreadsheetApp.getUi().alert('Group has been added to the waitlist.');
    
  } catch (error) {
    // Handle any errors that occur during the process
    SpreadsheetApp.getUi().alert('An error occurred while adding the group to the waitlist: ' + error.message);
  } finally {
    // Always release the lock, even if an error occurs
    lock.releaseLock();
  }
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
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var dataRange = vrSheet.getDataRange();
    var data = dataRange.getValues();
    var rowToUpdate = -1;

    // Find the row corresponding to the selected VR space
    for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
      if (data[i][0] === selectedSpace) { // Column A: VR Space
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate !== -1) {
      var updateRange = vrSheet.getRange(rowToUpdate, 3, 1, 5); // Columns C to G
      var rowData = [
        'Occupied',         // Column C: Status
        attendee.firstName, // Column D: First Name
        selectedGame,       // Column E: Game
        sessionId,          // Column F: Session ID
        new Date()          // Column G: Check-In Time
      ];
      updateRange.setValues([rowData]);
    } else {
      throw new Error("VR Space not found: " + selectedSpace);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while updating VR Spaces: ' + error.message);
  } finally {
    lock.releaseLock();
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
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var dataRange = trackerSheet.getDataRange();
    var data = dataRange.getValues();
    var rowToUpdate = -1;

    // Define column indices
    var colVRSpace = 15;        // Column O
    var colCheckOutTime = 10;   // Column J
    var colSessionStatus = 16;  // Column P

    for (var i = data.length - 1; i >= 1; i--) { // Start from the bottom
      if (data[i][colVRSpace - 1] === space && !data[i][colCheckOutTime - 1]) {
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate === -1) {
      throw new Error('No active session found for VR Space: ' + space);
    }

    var updateRange = trackerSheet.getRange(rowToUpdate, 1, 1, trackerSheet.getLastColumn());
    var rowData = updateRange.getValues()[0];

    rowData[colCheckOutTime - 1] = checkOutTime;
    rowData[colSessionStatus - 1] = 'Completed';

    updateRange.setValues([rowData]);

    // Update durations
    updateDurations(trackerSheet, rowToUpdate);

  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while updating the check-out in Tracker: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Frees up a VR space by marking it as available and clearing attendee information.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} space - The VR space to free.
 */
function freeVRSpace(vrSheet, space) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for the lock

    var dataRange = vrSheet.getDataRange();
    var data = dataRange.getValues();
    var rowToUpdate = -1;
    var selectedGame = '';

    for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
      if (data[i][0] === space) { // Column A: VR Space
        rowToUpdate = i + 1;
        selectedGame = data[i][1]; // Column B: Supported Games
        break;
      }
    }

    if (rowToUpdate !== -1) {
      var updateRange = vrSheet.getRange(rowToUpdate, 3, 1, 5); // Columns C to G
      var emptyData = ['', '', '', '', '']; // Clear Status, First Name, Game, Session ID, Check-In Time
      updateRange.setValues([['Available'].concat(emptyData.slice(1))]); // Set Status to 'Available', clear the rest

      // Invalidate the cache for the affected game(s)
      var supportedGames = selectedGame.split(',').map(function(game) { return game.trim(); });
      supportedGames.forEach(function(game) {
        invalidateAvailableSpacesCache(game);
      });
    } else {
      throw new Error("VR Space not found: " + space);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while freeing VR Space: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

function updateVRSpacesBatch(vrSheet, vrUpdates) {
  var data = vrSheet.getDataRange().getValues();
  var vrSpaceRowMap = {};

  for (var i = 1; i < data.length; i++) { // Skip header
    var vrSpace = data[i][0];
    vrSpaceRowMap[vrSpace] = i + 1; // Row number in the sheet
  }

  vrUpdates.forEach(function(update) {
    var row = vrSpaceRowMap[update.space];
    if (row) {
      vrSheet.getRange(row, 3, 1, update.data.length).setValues([update.data]);
    }
  });
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