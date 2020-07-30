var guard_manager = require("guard");

guard_manager.start({
	id: "guard",
	title: "Guard Manager",
	sensors: [
		//  home door reeds  //
		{ name: "s_home_door_1", device: "home_door_reed_1", control: "contact",  activationValue: "false" },

		//  home motion  //
		{ name: "s_home_motion_1", device: "home_motion_1", control: "occupancy",  activationValue: "true", triggerTimeout_s: 20  },
		{ name: "s_home_motion_2", device: "home_motion_2", control: "occupancy",  activationValue: "true" },

		//  bath door reeds  //
		{ name: "s_bath_door_1", device: "bath_door_reed_1", control: "contact",  activationValue: "false" },

		//  bath motion  //
		{ name: "s_bath_motion_1", device: "bath_motion_1", control: "occupancy",  activationValue: "true" },
  ],

	//  z5r, code panel, etc ..
	keys: [
		{
			name: "key_z5r",
			device: "wb-gpio",
			control: "A2_IN",
			activationValue: 1,
			states: [ "DISARMED", "AWAY_ARM" ]
		},
	],

  //  homebridge compatible  //
	stateTriggered: { name: "ALARM_TRIGGERED" },
  state: [
    // no devices to trigger
    { name: "DISARMED", devices: [] },

    // all devices to trigger
    { name: "AWAY_ARM" },

    // // 2 devices to trigger
    // {
    //   name: "NIGHT_ARM",
    //   devices: [
    //     "s_bath_door_1",
    //     "s_bath_door_2",
    //   ]
    // },
		//
    // // 1 device to trigger
    // {
    //   name: "STAY_ARM",
    //   devices: [
    //     "s_bath_door_2",
    //   ]
    // },
  ],
	onShot: function(shotsCount) {
		if (shotsCount) {
			log("Penetration found: " + shotsCount + " times");
		} else {
			log("Penetration found");
		}

		// //  siren on  //
		// dev["siren"]["siren"] = true;
    //
		// //  email  //
		// dev["email_manager"]["send"] = "Обнаружено проникновение !!";
    //
		// //  sms  //
		// dev["sms_manager"]["send"] = "Penetration found !!";
	},
	onGone: function() {
		// //  siren off  //
		// dev["siren"]["siren"] = false;
	},
	onNewState: function(state) {
		log("New state: " + state);

		// //  toggle lamp  //
		// dev["siren"]["lamp"] = state !== "DISARMED";
    //
		// //  siren off  //
		// dev["siren"]["siren"] = false;
	}
});
