# Peersuite
Peer to peer workspace

![Screenshot From 2025-05-11 20-38-36](https://github.com/user-attachments/assets/fccc483f-fa82-4e6c-9bdc-4a3d643f8004)


Peersuite is a open source, decentralized, private alternative to apps like discord or slack.
All data is sent only between ckients through encrypted WebRTC channels. There is no server.

The tools included are chat with file send, collaboarative document editing, a kanban board, screen sharing, video calling, and a shared whiteboard for drawing ideas.

This is the initial public release, happy to check out some PRs

Usage: You can use https://peersuite.space online, download the files and run them yourself, or grab an executable from releases.

## Docker

You can also run Peersuite using Docker.

1.  **Build the Docker image:**
    ```bash
    docker build -t peersuite .
    ```
2.  **Run the Docker container:**
    ```bash
    docker run -d -p 8080:80 peersuite
    ```
    This will start Peersuite and make it accessible at [http://localhost:8080](http://localhost:8080).

Alternatively, you can use the provided `docker-compose.yml` file:

1.  **Build and run with Docker Compose:**
    ```bash
    docker-compose up -d
    ```
    This will also start Peersuite and make it accessible at [http://localhost:8080](http://localhost:8080).



    If any teams are in need of a modified/whitelabel version, please message me.
