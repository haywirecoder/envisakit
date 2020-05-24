var Service, Characteristic, Chime, Bypass, AlarmDetected;
var inherits = require('util').inherits;

var wait_timeout = 500

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  // Chime Mode characteristic
  Chime = function() {
    Characteristic.call(this, 'Chime', '51258EAA-A505-11E5-BF7F-FEFF819CDC9F')

    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });

    this.value = this.getDefaultValue();
  };

  inherits(Chime, Characteristic);

  // Bypass Mode characteristic
  Bypass = function() {
    Characteristic.call(this, 'Bypass', '51258EAA-A505-2A2A-BF7F-FEFF819CDC9F')

    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });

    this.value = this.getDefaultValue();
  }

  inherits(Bypass, Characteristic);

  // Alarm Detected characteristic
  AlarmDetected = function() {
    Characteristic.call(this, 'Alarm Detected', '51258EAA-A505-3B3B-BF7F-FEFF819CDC9F')

    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });

    this.value = this.getDefaultValue();
  };

  inherits(AlarmDetected, Characteristic);

  homebridge.registerAccessory("homebridge-envisakit", "Envisakit", EnvisakitAccessory);
}

function EnvisakitAccessory(log, config) {

  this.name = config["name"];
  this.cmd = config["envisakit-path"];
  this.pin = config["pin"];
  this.cache_timeout = config["cache_timeout"] || 10;
  this.periodic = config["periodic_update"] || false;
  this.args = config["args"] || "";
  this.bypass = config["bypass_zone"] || undefined;
  this.alarm_detected = config["show_alarm_detected"] || true;
  this.chime = config["show_chime"] || true;
  this.battery_level = config["show_battery_level"] || true;
  this.status_log = config["status_log"] || false;

  this.log = log;
  this.update_pending = false;
  
  this.service = new Service.SecuritySystem(this.name);

  if(this.chime) {
    this.service
      .addCharacteristic(Chime)
      .on('get', this.getChimeState.bind(this))
      .on('set', this.setChimeState.bind(this));
  }

  if(this.battery_level) {
    this.service
      .addCharacteristic(Characteristic.StatusLowBattery)
      .on('get', this.getBatteryLevel.bind(this));
  }

  this.service
      .addCharacteristic(Characteristic.ObstructionDetected)
      .on('get', this.getReadyState.bind(this));

  this.service
      .addCharacteristic(Characteristic.StatusTampered)
      .on('get', this.getAlarmMemoryState.bind(this));

  if(this.alarm_detected) {
    this.service
        .addCharacteristic(AlarmDetected)
        .on('get', this.getAlarmMemoryState.bind(this));
  }
  
  this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getAlarmState.bind(this));

  this.service
      .getCharacteristic(Characteristic.StatusFault)
      .on('get', this.getFaultedState.bind(this));
  
  this.service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getAlarmState.bind(this))
      .on('set', this.setAlarmState.bind(this));

  if(this.bypass != undefined) {
    this.service
        .addCharacteristic(Bypass)
        .on('get', this.getBypassState.bind(this))
        .on('set', this.setBypassState.bind(this));
  }

  this.periodicUpdate(true);
}

EnvisakitAccessory.prototype.getServices = function() {
  return [this.service];
}

EnvisakitAccessory.prototype.periodicUpdate = function(first) {

  if(this.periodic) {

    this.log("Envisalink will be polled in " + this.cache_timeout + " seconds");
    setTimeout(function() {

      this.log("Polling envisalink...");
      this.fetchStatusWithCallback(
        function(callback) {
          this.log("Poll complete");
          this.periodicUpdate(false);
        }.bind(this));
    }.bind(this), first ? 100 : this.cache_timeout * 1000);

  }
}

EnvisakitAccessory.prototype.getFaultedState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    if(alarm_status["faulted"] == true && alarm_status["ready"] == false && alarm_status["faulted-zone"] != undefined) {
      zone = parseInt(alarm_status["faulted-zone"], 10);
      callback(null, zone);
    }
    else {
      callback(null, 0);
    }

  }.bind(this);

  this.performWithStatus(handle_data);

}

EnvisakitAccessory.prototype.getReadyState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined || 
       alarm_status["ready"] == undefined ||
       alarm_status["armed"] == undefined ) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    var obstruction_detected = (alarm_status["ready"] == false && alarm_status["armed"] == false)

    callback(null, obstruction_detected);

  }.bind(this);

  this.performWithStatus(handle_data);
}

EnvisakitAccessory.prototype.getAlarmMemoryState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined || 
       alarm_status["in_alarm"] == undefined || 
       alarm_status["alarm_in_memory"] == undefined ) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    var tampered = (alarm_status["in_alarm"] == true) || 
                   (alarm_status["alarm_in_memory"] == true);

    if(tampered) {
      callback(null, Characteristic.StatusTampered.TAMPERED);
    }
    else {
      callback(null, Characteristic.StatusTampered.NOT_TAMPERED);
    }

  }.bind(this);

  this.performWithStatus(handle_data);
}

EnvisakitAccessory.prototype.getChimeState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined || alarm_status["chime"] == undefined) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    callback(null, alarm_status["chime"]);

  }.bind(this);

  this.performWithStatus(handle_data);
}

EnvisakitAccessory.prototype.getBatteryLevel = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined || alarm_status["low-battery"] == undefined) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    if(alarm_status["low-battery"]) {
      callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
    }
    else {
      callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }

  }.bind(this);

  this.performWithStatus(handle_data);
}

EnvisakitAccessory.prototype.getBypassState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined || alarm_status["bypassed"] == undefined) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    callback(null, alarm_status["bypassed"]);

  }.bind(this);

  this.performWithStatus(handle_data);
}

EnvisakitAccessory.prototype.getAlarmState = function(callback) {

  var handle_data = function(alarm_status) {

    if(alarm_status == undefined) {
      callback(new Error("Could not determine state of alarm"));
      return;
    }

    if(alarm_status["armed"] == false) {
      callback(null, Characteristic.SecuritySystemCurrentState.DISARMED);
      return;
    }

    if(alarm_status["in_alarm"] == true || alarm_status["alarm_in_memory"] == true) {
      callback(null, Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
      return;
    }

    switch(alarm_status["arm-mode"]) {

      case "away":
      this.log("System is away armed");
      callback(null, Characteristic.SecuritySystemCurrentState.AWAY_ARM);
      break;

      case "stay":
      this.log("System is stay armed");
      callback(null, Characteristic.SecuritySystemCurrentState.STAY_ARM);
      break;

      case "night":
      this.log("System is night armed");
      callback(null, Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
      break;

      case "armed":
      this.log("System is armed");
      callback(null, Characteristic.SecuritySystemCurrentState.AWAY_ARM);
      break;

      default:
      this.log("Unknown arm state: %s", JSON.stringify(alarm_status));
      callback(new Error("Could not determine state of alarm"));
      break;
    }
  }.bind(this);
  this.performWithStatus(handle_data);

}
  
EnvisakitAccessory.prototype.setAlarmState = function(state, callback) {

  var targetState = ""
  var exec = require('child_process').exec;

  if(this.update_pending) {
    setTimeout(function () {
      this.log("Waiting " + wait_timeout.toString() + "ms to set alarm state...");
      this.setAlarmState(state, callback);
    }.bind(this), wait_timeout);
    return;
  }

  switch(state) {
    case Characteristic.SecuritySystemCurrentState.DISARMED:
      targetState = "disarm";
      break;

    case Characteristic.SecuritySystemCurrentState.AWAY_ARM:
      targetState = "arm";
      break;

    case Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
      targetState = "night";
      break;

    case Characteristic.SecuritySystemCurrentState.STAY_ARM:
      targetState = "stay";
      break;

    default:
      targetState = "";
      break;

  }

  if(targetState == "") {
    callback(new Error("Error setting state to %s", state));
    return;
  }

  var command = this.cmd + " " + targetState + " -p " + this.pin + ' ' + this.args

  this.log("Attempting to set alarm state to: %s, via command: %s", targetState, command);

  var child = exec(command,
  function(error, stdout, stderr) {

    if(error != null) {
      this.log("Error - could not set alarm state, error = %d", error.code);
      callback(new Error("Could not issue command, error = %d", error.code));
    }
    else {
      this.log("Alarm state set");
      this.service
        .setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
      if(this.last_update_dict != undefined) {
        this.last_update_dict["armed"] = (targetState != "disarm");
        this.last_update_dict["arm-mode"] = targetState;
      }
      callback(null);
    }

  }.bind(this));
}

EnvisakitAccessory.prototype.setChimeState = function(state, callback) {

  var exec = require('child_process').exec;
  var command = this.cmd + " togglechime -p " + this.pin + ' ' + this.args

  if(this.update_pending) {
    setTimeout(function () {
      this.log("Waiting " + wait_timeout.toString() + "ms to set chime state...");
      this.setChimeState(state, callback);
    }.bind(this), wait_timeout);
    return;
  }

  var toggle_chime = function(error, stdout, stderr) {

    this.log("Attempting to set alarm chime, via command: %s", command);

    if(error != null) {
      callback(new Error("Could not issue command, error = %d", error.code));
    }
    else {
      if(this.last_update_dict != undefined) {
        this.last_update_dict["chime"] = state;
      }
      callback(null);
    }

  }.bind(this)

  var child = exec(command, toggle_chime);
}

EnvisakitAccessory.prototype.setBypassState = function(state, callback) {

  var exec = require('child_process').exec;
  var command = this.cmd + (state ? " bypass -x " + this.bypass + " -p " : " disarm -p ") + this.pin + ' ' + this.args;

  if(this.update_pending) {
    setTimeout(function () {
      this.log("Waiting " + wait_timeout.toString() + "ms to set bypass state...");
      this.setBypassState(state, callback);
    }.bind(this), wait_timeout);
    return;
  }

  if(this.bypass == undefined) {
    this.log("No bypass zone configured; skipping command");
    callback(new Error("No bypass zone configured"));
    return;
  }

  if(state == false) {
    command = this.cmd + " disarm -p " + this.pin + ' ' + this.args;
  }

  var toggle_bypass = function(error, stdout, stderr) {

    this.log("Attempting to set alarm bypass, via command: %s", command);

    if(error != null) {
      callback(new Error("Could not issue command, error = %d", error.code));
    }
    else {
      if(this.last_update_dict != undefined) {
        this.last_update_dict["bypassed"] = state;
      }
      callback(null);
    }

  }.bind(this)

  var child = exec(command, toggle_bypass);
}

// Returns true if we need to poll envisakit for alarm properties.
// Returns false if we can access accessory.last_update_dict directly.
EnvisakitAccessory.prototype.needsUpdate = function(threshold_seconds) {
  if(this.periodic == true) {
    return false;
  }
  if(this.last_update_time == undefined){
    return true;
  }
  else {
    var now = new Date();
    var diff_seconds = (now.getTime() - this.last_update_time.getTime()) / 1000;
    return (diff_seconds > threshold_seconds);
  }
}

// Returns true if the plugin is currently polling envisakit
EnvisakitAccessory.prototype.updateIsPending = function() {
  return this.update_pending;
}

// Processes stdout from envisakit and caches result on the accessory.
EnvisakitAccessory.prototype.processUpdate = function(update_string) {
  
  try {
    var alarm_status = JSON.parse(update_string);
    var old_time = this.last_update_time;
    this.last_update_time = new Date();
    this.last_update_dict = alarm_status;

    if(old_time) {
      var time_diff = (this.last_update_time.getTime() - old_time.getTime()) / 1000;
      this.log("Status update complete after " + time_diff.toString() + " seconds");
    }

    return alarm_status;
  }
  catch(err) {
    this.log("Could not parse envisakit status: string = %s, error = %s", update_string, err);
    return undefined;
  }

}

// Polls envisakit, caches the response, and issues callback.
// The callback must take one parameter - the update dictionary.
// On failure, the callback will be called with undefined parameter.
EnvisakitAccessory.prototype.fetchStatusWithCallback = function(callback) {
  var exec = require('child_process').exec;
  var command = this.cmd + ' status -j' + ' ' + this.args
  this.log("Getting current state via command: %s", command);

  this.update_pending = true;

  var child = exec(command,
    function(error, stdout, stderr) {

      // Our command did not execute correctly
      if(error) {
        this.log("Envisakit command failed (%d), errors = %s", error.code, stderr);
        this.update_pending = false;
        callback(undefined);
        return;
      }

      // Out command executed correctly. Process the result.
      var alarm_status = this.processUpdate(stdout);
      this.logStatus(alarm_status);
      this.update_pending = false;
      callback(alarm_status);

  }.bind(this));
}

EnvisakitAccessory.prototype.logStatus = function(alarm_status) {
  if(this.status_log) {
    var stringify = JSON.stringify(alarm_status, null, 4);
    this.log(stringify);
  }
}

EnvisakitAccessory.prototype.performWithStatus = function(callback) {
  if(this.needsUpdate(this.cache_timeout)) {
    //this.log("Using direct poll for status update");
    this.fetchStatusWithCallback(callback);
  }
  else {
    // this.log("Using cached data for status update");
    callback(this.last_update_dict);
  }
}


