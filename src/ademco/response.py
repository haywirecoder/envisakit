
import sys

def has_flag(bitfield, flag):
    return ((bitfield & flag) == flag)


class AdemcoResponse:

    RESPONSE_UPDATE = '00'
    RESPONSE_ZONE_CHANGE = '01'
    RESPONSE_PARTITION_STATE = '02'
    RESPONSE_CID_EVENT = '03'
    RESPONSE_TIMER_DUMP = 'FF'
    RESPONSE_TYPES = (
        RESPONSE_UPDATE,
        RESPONSE_ZONE_CHANGE,
        RESPONSE_PARTITION_STATE,
        RESPONSE_CID_EVENT,
        RESPONSE_TIMER_DUMP,
    )

    INDEX_TYPE = 0

    # RESPONSE_UPDATE
    INDEX_UPDATE_PARTITION = 1
    INDEX_UPDATE_STATE_BITFIELD = 2
    INDEX_UPDATE_USERZONE = 3
    INDEX_UPDATE_BEEP = 4
    INDEX_UPDATE_ALPHA = 5

    UPDATE_FLAG_IN_ALARM = 1 << 0
    UPDATE_FLAG_ALARM_IN_MEMORY = 1 << 1
    UPDATE_FLAG_ARMED_AWAY = 1 << 2
    UPDATE_FLAG_AC_PRESENT = 1 << 3
    UPDATE_FLAG_BYPASS = 1 << 4
    UPDATE_FLAG_CHIME = 1 << 5
    UPDATE_FLAG_ARMED = 1 << 7
    UPDATE_FLAG_ALARM_FIRE = 1 << 8
    UPDATE_FLAG_SYSTEM_TROUBLE = 1 << 9
    UPDATE_FLAG_READY = 1 << 12
    UPDATE_FLAG_FIRE = 1 << 13
    UPDATE_FLAG_LOWBAT = 1 << 14
    UPDATE_FLAG_ARMED_STAY = 1 << 15

    # RESPONSE_ZONE_CHANGE

    # RESPONSE_PARTITION_STATE
    INDEX_PARTITION_STATE_VALUE = 1

    PARTITION_STATE_UNUSED = 0
    PARTITION_STATE_READY = 1
    PARTITION_STATE_READY_WITH_BYPASS = 2
    PARTITION_STATE_NOTREADY = 3
    PARTITION_STATE_ARMED_STAY = 4
    PARTITION_STATE_ARMED_AWAY = 5
    PARTITION_STATE_ARMED_INSTANT = 6
    PARTITION_STATE_EXIT_DELAY = 7
    PARTITION_STATE_ALARM = 8
    PARTITION_STATE_ALARM_IN_MEMORY = 9

    # RESPONSE_CID_EVENT

    # RESPONSE_TIMER_DUMP

    LENGTH_UPDATE = 6

    def __init__(self):
        self.response_data = None

    def response_type(self):
        assert self.response_data is not None, "Method must be called after a successful -parse:"

        if self.response_data[0] in self.RESPONSE_TYPES:
            return self.response_data[0]
        else:
            return None

    def bitfield_from_index(self, index):
        return int(self.response_data[index], 16)

    def update_has_flags(self, flags):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"
        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)
        return has_flag(bitfield, flags)

    def update_is_armed(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"

        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)
        armed = has_flag(bitfield, self.UPDATE_FLAG_ARMED)
        away_armed = has_flag(bitfield, self.UPDATE_FLAG_ARMED_AWAY)
        stay_armed = has_flag(bitfield, self.UPDATE_FLAG_ARMED_STAY)

        return armed or away_armed or stay_armed

    def update_is_ready(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"

        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)
        ready = has_flag(bitfield, self.UPDATE_FLAG_READY)

        return ready

    def update_is_bypass(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"

        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)
        bypass = has_flag(bitfield, self.UPDATE_FLAG_BYPASS)

        return bypass

    def update_text(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"
        return self.response_data[self.INDEX_UPDATE_ALPHA]

    def update_dict(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"

        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)
        update_dict = {}

        update_dict["ready"] = has_flag(bitfield, self.UPDATE_FLAG_READY)

        update_dict["in_alarm"] = has_flag(bitfield, self.UPDATE_FLAG_IN_ALARM) or \
            has_flag(bitfield, self.UPDATE_FLAG_ALARM_FIRE) or \
            has_flag(bitfield, self.UPDATE_FLAG_FIRE)

        update_dict["alarm_in_memory"] = has_flag(bitfield, self.UPDATE_FLAG_ALARM_IN_MEMORY)

        update_dict["fire"] = has_flag(bitfield, self.UPDATE_FLAG_FIRE) or \
            has_flag(bitfield, self.UPDATE_FLAG_ALARM_FIRE)

        update_dict["chime"] = has_flag(bitfield, self.UPDATE_FLAG_CHIME)

        if has_flag(bitfield, self.UPDATE_FLAG_ARMED_AWAY):
            update_dict["arm-mode"] = "away"
            update_dict["armed"] = True
        elif has_flag(bitfield, self.UPDATE_FLAG_ARMED_STAY):
            if "night" in self.update_text().lower():
                update_dict["arm-mode"] = "night"
            else:
                update_dict["arm-mode"] = "stay"
            update_dict["armed"] = True
        elif has_flag(bitfield, self.UPDATE_FLAG_ARMED_STAY):
            update_dict["arm-mode"] = "stay"
            update_dict["armed"] = True
        elif has_flag(bitfield, self.UPDATE_FLAG_ARMED):
            update_dict["arm-mode"] = "armed"
            update_dict["armed"] = True
        else:
            update_dict["armed"] = False
            update_dict["arm-mode"] = "disarmed"

        update_dict["faulted"] = (
            not update_dict["ready"]) and (
                (not update_dict["armed"]) and
                (not update_dict["in_alarm"]) and
                (not update_dict["alarm_in_memory"])
        )

        if update_dict["faulted"]:
            update_dict["faulted-zone"] = self.response_data[self.INDEX_UPDATE_USERZONE]

        update_dict["ac-present"] = has_flag(bitfield, self.UPDATE_FLAG_AC_PRESENT)
        update_dict["bypassed"] = has_flag(bitfield, self.UPDATE_FLAG_BYPASS)
        update_dict["low-battery"] = has_flag(bitfield, self.UPDATE_FLAG_LOWBAT)
        update_dict["system-trouble"] = has_flag(bitfield, self.UPDATE_FLAG_SYSTEM_TROUBLE)

        return update_dict

    def update_summary(self):
        assert self.response_type() == self.RESPONSE_UPDATE, "Method is only for update response types"

        summary = ''
        bitfield = self.bitfield_from_index(self.INDEX_UPDATE_STATE_BITFIELD)

        if has_flag(bitfield, self.UPDATE_FLAG_READY):
            summary += 'Ready' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_IN_ALARM):
            summary += '*** ALARM ***' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_ALARM_IN_MEMORY):
            summary += '*** ALARM IN MEMORY ***' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_ALARM_FIRE):
            summary += '*** ALARM - FIRE ZONE ***' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_FIRE):
            summary += '*** FIRE ***' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_ARMED):
            summary += 'System ARMED' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_ARMED_AWAY):
            summary += 'System ARMED (Away)' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_ARMED_STAY):
            summary += 'System ARMED (Partial)' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_AC_PRESENT):
            summary += 'AC Present' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_BYPASS):
            summary += 'Bypass Enabled' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_CHIME):
            summary += 'Chime Enabled' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_LOWBAT):
            summary += 'Low Battery' + '\n'

        if has_flag(bitfield, self.UPDATE_FLAG_SYSTEM_TROUBLE):
            summary += 'Check Panel - System Trouble' + '\n'

        return summary

    def parse(self, response_string):

        if not response_string.endswith('$') or not response_string.startswith('%'):
            if len(response_string) > 0:
                print ("[Warning] Received invalid response: " + str(response_string), file=sys.stderr)
            return False

        self.response_data = response_string[1:len(response_string) - 1].split(',')
        response_type = self.response_type()

        if response_type == self.RESPONSE_UPDATE:

            # We have detected an update response. Ensure that it is the correct size.
            if len(self.response_data) != self.LENGTH_UPDATE:
                print ("[Warning] Received update, but invalid format: " + str(response_string), file=sys.stderr)
                return False

            print ("Update: " + self.update_text(), file=sys.stderr)

            return True

        elif response_type == self.RESPONSE_ZONE_CHANGE:
            print ("Received zone change... but not handled yet", file=sys.stderr)
            return True

        elif response_type == self.RESPONSE_PARTITION_STATE:
            print ("Received partition state... but not handled yet", file=sys.stderr)
            return True

        elif response_type == self.RESPONSE_CID_EVENT:
            print ("Received CID event... but not handled yet", file=sys.stderr)
            return True

        elif response_type == self.RESPONSE_TIMER_DUMP:
            print ("Received timer dump... but not handled yet", file=sys.stderr)
            return True
        else:
            print ("[Warning] Received unknown response type: " + str(response_string), file=sys.stderr)
            return False