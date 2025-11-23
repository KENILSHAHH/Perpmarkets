from websocket import WebSocketApp
import json
import time
import threading

MARKET_CHANNEL = "market"
USER_CHANNEL = "user"


class WebSocketOrderBook:
    def __init__(self, channel_type, url, data, auth, message_callback, verbose):
        self.channel_type = channel_type
        self.url = url
        self.data = data
        self.auth = auth
        self.message_callback = message_callback
        self.verbose = verbose
        furl = url + "/ws/" + channel_type
        print(f"Initializing WebSocket connection to: {furl}")
        self.ws = WebSocketApp(
            furl,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open,
        )
        self.orderbooks = {}

    def on_message(self, ws, message):
        print(message)
        pass

    def on_error(self, ws, error):
        print("Error: ", error)
        exit(1)

    def on_close(self, ws, close_status_code, close_msg):
        print("closing")
        exit(0)

    def on_open(self, ws):
        print(f"Connection opened for {self.channel_type} channel")
        if self.channel_type == MARKET_CHANNEL:
            message = json.dumps({"assets_ids": self.data, "type": MARKET_CHANNEL})
            print(f"Sending subscription message: {message}")
            ws.send(message)
        elif self.channel_type == USER_CHANNEL and self.auth:
            message = json.dumps(
                {"markets": self.data, "type": USER_CHANNEL, "auth": self.auth}
            )
            print(f"Sending subscription message: {message}")
            ws.send(message)
        else:
            print(f"Error: Invalid channel type or missing auth")
            exit(1)

        thr = threading.Thread(target=self.ping, args=(ws,))
        thr.start()
        print("Ping thread started")

    def ping(self, ws):
        while True:
            ws.send("PING")
            time.sleep(10)

    def run(self):
        print(f"Starting WebSocket connection for {self.channel_type} channel...")
        self.ws.run_forever()


if __name__ == "__main__":
    print("Script starting...")
    import sys
    sys.stdout.flush()
    url = "wss://ws-subscriptions-clob.polymarket.com"
    #Complete these by exporting them from your initialized client. 
    api_key = "019aad74-85a6-7187-b05b-7ad453cd972d"
    api_secret = "h1ot9KuamN0Q8oY31E1O9j4dmV18ry33ijRSs5EMKaw="
    api_passphrase = "2f8a60f7328f51db15f835e6885a1416d79138ac06d86b47380b6ad20fda6a2d"

    asset_ids = [
        "52271828686363627532080941754011409197193140345647396859033179798075082420208",
    ]
    condition_ids = [] # no really need to filter by this one

    auth = {"apiKey": api_key, "secret": api_secret, "passphrase": api_passphrase}

    print("Creating market connection...")
    market_connection = WebSocketOrderBook(
        MARKET_CHANNEL, url, asset_ids, auth, None, True
    )
    user_connection = WebSocketOrderBook(
        USER_CHANNEL, url, condition_ids, auth, None, True
    )

    print("Running market connection...")
    market_connection.run()
    # user_connection.run()