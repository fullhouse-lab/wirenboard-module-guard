// TODO: names without spaces in config
// TODO: get sensors values on reload, not only changed

var MODULE_NAME 		= "guard_manager";
var MODULE_VERSION  = "v.1.6";

var data = {};

exports.start = function(config) {
	if (!validateConfig(config)) return;

	//  init data  //
	data[config.id] = {};
	data[config.id].timer_shotDuration = null;
	data[config.id].timer_triggerTimeout = {};
	config.sensors.forEach(function(sensor) {
		if (sensor.triggerTimeout_s)
		data[config.id].timer_triggerTimeout[sensor.name] = null;
	});

	//  device  //
	createDevice(config);

	//  rules  //
	createRule_BTN_test(config.id, config.stateTriggered.name);
	config.state.forEach( function(state) {
		createRule_BTN_state(config.id, state.name);
	});
	createRule_TEXT_state(config.id, config.state, config.sensors, config.onNewState);
	createRule_TEXT_status(config.id,
		config.stateTriggered.name,
		config.onShot,
		config.onGone);

	config.keys.forEach( function(item) {
		createRule_externalKey(
			config.id,
			item.device,
	  	item.control,
	  	item.name,
			(item.activationValue) ? item.activationValue : 1
		);
		createRule_VALUE_key(config.id, item.name, item.states);
	});

	config.sensors.forEach( function(item) {
		createRule_externalSensor(config.id,
			item.device,
	  	item.control,
	  	item.name,
			(item.activationValue) ? item.activationValue : 1,
			item.triggerTimeout_s,
			config.state);
		createRule_VALUE_sensor(config.id, item.name, config.stateTriggered.name);
	});

  log(config.id + ": Started (" + MODULE_NAME + " " + MODULE_VERSION + ")");
};

//  Validate config  //

var validateConfig = function(_config) {
  if (!_config) {
    log("Error: " + MODULE_NAME + ": No config");
    return false;
  }

  if (!_config.id || !_config.id.length) {
    log("Error: " + MODULE_NAME + ": Config: Bad id");
    return false;
  }

  if (!_config.title || !_config.title.length) {
    log("Error: " + MODULE_NAME + ": Config: Bad title");
    return false;
  }

  if (!_config.sensors) {
    log("Error: " + MODULE_NAME + ": Config: Bad sensors");
    return false;
  }

	if (!_config.stateTriggered || !_config.stateTriggered.name) {
		_config.stateTriggered = { name: "ALARM" };
	}

	//  no state  //
  if (!_config.state) {
		_config.state = [
			{ name: "DISARMED", devices: [] },
			{ name: "ARMED" }
		];
  }

	//  state found  //
	else {
		if (!_config.state[0].name) {
			log("Error: " + MODULE_NAME + ": Config: Bad state");
	    return false;
		}
	}

  return true;
}

//
//  Device  //
//

function createDevice(config) {
	var cells = {
		enabled: { type: "switch", value: true, readonly: false },
		version: { type: "text", value: MODULE_VERSION },
		test: 	 { type: "pushbutton", readonly: false },
		shot_timeout_sec: 			{ type: "range",  max: 300, value: 60, readonly: false },
		session_max_shots: 			{ type: "range",  max: 10, 	value: 3, readonly: false },
		session_shots_counter: 	{ type: "value", 	value: 0, readonly: false },
	}

	//  sensors  //
	config.sensors.forEach( function(item) {
	  cells[item.name] = { type: "value", value: 0, readonly: false };
	});

	//  keys  //
	config.keys.forEach( function(item) {
	  cells[item.name] = { type: "value", value: 0, readonly: false };
	});

	//  state  //
	var state_current = config.state[0].name;
	config.state.forEach( function(state) {
		cells[state.name] = { type: "pushbutton" };

		//  default disarmed state  //
		if (state.devices && !state.devices.length) state_current = state.name;
	});
	cells["state"] = { type: "text", value: state_current, forceDefault: true, readonly: false };
	cells["status"] = { type: "text", value: state_current, forceDefault: true, readonly: false };

	defineVirtualDevice(config.id, {
	  title: config.title,
	  cells: cells
	});
}

//
//  Rules  //
//

function createRule_BTN_test(device_id, triggeredName) {
	defineRule({
    whenChanged: device_id + "/test",
    then: function (newValue, devName, cellName) {
			//  alarm  //
			dev[device_id]["status"] = "";
			dev[device_id]["status"] = triggeredName;
		}
	});
}

function createRule_BTN_state(device_id, name) {
	defineRule({
    whenChanged: device_id + "/" + name,
    then: function (newValue, devName, cellName) {
			//  check already found  //
			if (dev[device_id]["state"] !== name) {
				dev[device_id]["state"] = name;
				log(device_id + ": New state: " + name);
			}
		}
	});
}

//  sensor => device sensor  //

function createRule_externalSensor(device_id,
	device,
	control,
	name,
	activationValue,
	triggerTimeout_s,
	configState) {
	defineRule({
    whenChanged: device + "/" + control,
    then: function (newValue, devName, cellName) {
			//  check enabled  //
      if (!dev[device_id]["enabled"]) return;

    	//  get values  //
    	var value = (newValue == activationValue) ? 1 : 0;

			//  check triggered  //
			if (!value) return;

			//  get devices  //
			var state_devices = getStateDevices(configState, dev[device_id]["state"]);

			//  check handled  //
			if (!isDeviceHandled(state_devices, name)) return;

			//  need timeout  //
			if (triggerTimeout_s) {
				data[device_id].timer_triggerTimeout[name] = setTimeout(function() {
					if (dev[device_id][name] !== value) dev[device_id][name] = value;
				}, triggerTimeout_s * 1000);
			}

			//  no timeout  //
			else {
				//  save new  //
				if (dev[device_id][name] !== value) dev[device_id][name] = value;
			}
		}
	});
}

function createRule_VALUE_sensor(device_id, name, triggeredName) {
	defineRule({
    whenChanged: device_id + "/" + name,
    then: function (newValue, devName, cellName) {
			//  check smoke found  //
			if (!newValue) return;

			//  check enabled  //
      if (!dev[device_id]["enabled"]) return;

			//  check session max shots  //
    	if (dev[device_id]["session_max_shots"] !== 0
    	&& dev[device_id]["session_shots_counter"] >= dev[device_id]["session_max_shots"]) return;

			//  check already ringing  //
			if (data[device_id].timer_shotDuration) return;

			//  trigger  //
			dev[device_id]["status"] = "";
			dev[device_id]["status"] = triggeredName;
		}
	});
}

function createRule_TEXT_state(device_id, configState, configSensors, cb_onNewState) {
	defineRule({
    whenChanged: device_id + "/state",
    then: function (newValue, devName, cellName) {
			if (cb_onNewState) cb_onNewState(newValue);

			//  clear shots counter  //
      dev[device_id]["session_shots_counter"] = 0;

			//  clear timer  //
			if (data[device_id].timer_shotDuration) {
				clearTimeout(data[device_id].timer_shotDuration);
				data[device_id].timer_shotDuration = null;
			}

			//  clear trigger timeout timers  //
			Object.keys(data[device_id].timer_triggerTimeout).forEach(function(item) {
				if (data[device_id].timer_triggerTimeout[item]) {
					clearTimeout(data[device_id].timer_triggerTimeout[item]);
					data[device_id].timer_triggerTimeout[item] = null;
				}
			});

			//  set status  //
			dev[device_id]["status"] = newValue;

			//  get devices  //
			var state_devices = getStateDevices(configState, newValue);

			//  switch off all unhandled sensors  //
			configSensors.forEach(function(sensor) {
				if (!isDeviceHandled(state_devices, sensor.name)) dev[device_id][sensor.name] = 0;
			});
		}
	});
}

function createRule_TEXT_status(device_id, triggeredName, cb_onShot, cb_onGone) {
	defineRule({
    whenChanged: device_id + "/status",
    then: function (newValue, devName, cellName) {
			if (newValue !== triggeredName) return;

			//  increment shots and emit  //
    	if (dev[device_id]["session_max_shots"] !== 0) {
    		dev[device_id]["session_shots_counter"] += 1;
				if (cb_onShot) cb_onShot(dev[device_id]["session_shots_counter"]);
    	} else {
				if (cb_onShot) cb_onShot(0);
    	}

      //  start timer if neccessery  //
			if (data[device_id].timer_shotDuration) clearTimeout(data[device_id].timer_shotDuration);
			if(!dev[device_id]["shot_timeout_sec"]) return;
      data[device_id].timer_shotDuration = setTimeout(function() {
				data[device_id].timer_shotDuration = null;
      	//  gone  //
	      if (cb_onGone) cb_onGone();
      }, dev[device_id]["shot_timeout_sec"] * 1000);
		}
	});
}


function createRule_externalKey(device_id,
	device,
	control,
	name,
	activationValue) {
	defineRule({
    whenChanged: device + "/" + control,
    then: function (newValue, devName, cellName) {
			//  check enabled  //
      if (!dev[device_id]["enabled"]) return;

    	//  get values  //
    	var value = (newValue == activationValue) ? 1 : 0;

			if (dev[device_id][name] !== value) dev[device_id][name] = value;
		}
	});
}

function createRule_VALUE_key(device_id, name, states) {
	defineRule({
    whenChanged: device_id + "/" + name,
    then: function (newValue, devName, cellName) {
			//  check enabled  //
      if (!dev[device_id]["enabled"]) return;

			if (!newValue) return;

			//  toggle state  //
			var index = states.indexOf(dev[device_id]["state"]);
			// var index = states.findIndex(function (state) {
			// 	returnt (state == dev[device_id]["state"])
			// });
			index += 1;
			if (index > states.length - 1) { index = 0; }

			dev[device_id]["state"] = states[index];
		}
	});
}

//  Helpers  //

function getStateDevices(configState, currentState) {
	var state_devices = null;
	configState.forEach(function(_state) {
		if (_state.name === currentState && _state.devices) state_devices = _state.devices;
	});
	return state_devices;
}

function isDeviceHandled(state_devices, name) {
	if (state_devices === null) {
		return true;
	}
	else if (state_devices.length === 0) {
		return false;
	}
	else {
		return (state_devices.indexOf(name) !== -1);
	}
}
