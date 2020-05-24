import socket
import select
import sys

from ademco.common import RUNLOOP_INTERVAL_NORMAL


class AdemcoServerConnection:

    STATE_PENDING = 0
    STATE_CONNECTED = 1
    STATE_DISCONNECTED = 2

    def __init__(self, host, port, password, *args, **kwargs):
        self.host = host
        self.port = port
        self.password = password
        self.state = self.STATE_PENDING
        self.commands = []
        self.responses = []

    def add_command(self, command):
        if command is None:
            return
        self.commands.insert(0, command)

    def _add_response(self, response):
        self.responses.insert(0, response)

    def pop_responses(self):
        responses = list(self.responses)
        self.responses = []
        return responses

    def connection_state(self):
        return self.state

    def connect_and_login(self):

        # Create a TCP/IP socket
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        # Connect to envisalink
        print ( "Connecting to %s:%s" % (self.host, str(self.port)),file=sys.stderr)
        server_address = (self.host, self.port)
        self.sock.connect(server_address)

        # Verify challenge
        data = self.sock.recv(8)
        
        if data.strip().lower() != str.encode('login:', 'utf-8').lower():
            raise Exception("Connection failed - Invalid challenge")

        # Send login
        login_phrase =str.encode(self.password + '\r\n')
        self.sock.sendall(login_phrase)

        # Determine response
        data = self.sock.recv(4)
        if data.strip().lower() == str.encode('OK','utf-8').lower():
            # print ( "Connected")
            self.connection_cycle()
        else:
            raise Exception("Connection failed - Invalid code")

    def connection_cycle(self):

        # Make socket non-blocking
        self.sock.setblocking(0)

        # Update state
        self.state = self.STATE_CONNECTED

        try:
            # Receive data
            data = ''
            sending_commands = (len(self.commands) > 0)
            ready = select.select([self.sock], [], [], RUNLOOP_INTERVAL_NORMAL)
            if ready[0]:
                data = self.sock.recv(4096)

            if data is None:
                return
            elif len(data) > 0:
                # print ( "Received %d bytes from server" % len(data))
                for response_line in data.decode().split('\r\n'):
                    self._add_response(response_line.strip())

            # Send data
            if sending_commands:
                print ("Sending command: " + self.commands[-1],file=sys.stderr)
                self.sock.sendall(str.encode(self.commands[-1] + '\r\n','utf-8'))
                self.commands.pop()

        except Exception as e:
            print ("Network exception: " + str(e),file=sys.stderr)
            self.disconnect()

    def disconnect(self):
        self.state = self.STATE_DISCONNECTED
        self.sock.close()
        
    def connect(self):
        try:
            self.connect_and_login()
        except Exception as e:
            print ( "Connection failed: " + str(e),file=sys.stderr)
            self.state = self.STATE_DISCONNECTED
