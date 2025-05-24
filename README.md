# Peersuite
Peer to peer workspace

![Screenshot From 2025-05-18 18-45-22](https://github.com/user-attachments/assets/85a61165-6373-4c40-a062-dcb36c4ac3f2)


Peersuite is a open source, decentralized, private alternative to apps like discord or slack.
All data is sent only between clients through encrypted WebRTC channels. There is no server.

The tools included are chat with file sending, collaborative document editing, a kanban board, screen sharing, video calling, audio chat, and a shared whiteboard for drawing ideas.

If this is something you would like to be a part of, please send a PR.

Usage: You can use https://peersuite.space online, download a docker image and run peersuite yourself, build your own docker image, or grab an executable from [releases](https://github.com/openconstruct/Peersuite/releases). 

## Docker

### Docker Hub

#### Pull the image from [Docker Hub](https://hub.docker.com/repository/docker/openconstruct/peersuite)   
```bash
docker pull openconstruct/peersuite
```    

#### Run the image
```bash
docker run -p 8080:80 openconstruct/peersuite
```

This will start Peersuite and make it accessible at [http://localhost:8080](http://localhost:8080).

### Locally build the image and then run it
#### Build the Docker image
```bash
docker build -t peersuite .
```
### Run the Docker container
```bash
docker run -d -p 8080:80 peersuite
```

This will start Peersuite and make it accessible at [http://localhost:8080](http://localhost:8080).

### Build and run it via docker compose

```bash
docker compose up -d
```

This will start Peersuite and make it accessible at [http://localhost:8080](http://localhost:8080).
