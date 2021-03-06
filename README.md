# EnvisaKit

EnvisaKit is a command-line interface for the [Eyez-On Envisalink](http://www.eyezon.com) module with Honeywell Vista panels. It allows you to arm and disarm the alarm system, as well as custom commands.

**Note**: This project _is not_ compatible with DSC security panels.
** Updated for newest version of python

# HomeKit and Siri

Connect EnvisaKit to HomeKit in order to control your alarm panel through Siri.

1. Install EnvisaKit (see below)
2. Install [HomeBridge](https://github.com/nfarina/homebridge)
3. Install the [homebridge-envisakit plugin]

# Installation

```

# Clone the repository
$ git clone 'https://github.com/haywirecoder/envisakit.git'
$ cd envisakit


# Configure EnvisaKit (see Configuration section)
$ cp envisakit-config.json.sample envisakit-config.json
$ nano envisakit-config.json

```

# Usage

```

# Arming the system with code 1234
$ ./envisakit-cli arm -p 1234
Sending command: 12342

# Disarming the system with code 1234
$ ./envisakit-cli disarm -p 1234
Sending command: 12341

# Getting the status of the system
$ ./envisakit-cli status
Ready
AC Present

# Output JSON
$ ./envisakit-cli status -j
{"alarm_in_memory": false, "faulted": false, "in_alarm": false, "fire": false, "low-battery": false, "arm-mode": "disarmed", "ac-present": true, "bypassed": false, "system-trouble": false, "ready": true, "chime": false, "armed": false}

```


# Configuration

EnvisaKit works through the Ademco Third-Party Interface (TPI) running on the Envisalink module.

Configuration sample:

```

{
	"host": "envisalink",
	"port": 4025,
	"password": "user"
}

```

* "host": Hostname or IP of the Envisalink module (required, default: "envisalink")
* "port": Port for the Envisalink TPI (required, default: 4025)
* "password": Password for the Envisalink TPI (required, default: "user")




