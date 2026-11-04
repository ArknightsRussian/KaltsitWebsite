# Kaltsit Developer Docs

## Table of Contents
- [Getting Started](#getting-started)
  - [Environment Setup](#environment-setup)
  - [Assets Pipeline](#assets-pipeline)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Documentation](#documentation)

## Prerequisites
*   [Docker engine](https://docs.docker.com/engine/install/)
*   [Docker Compose](https://docs.docker.com/compose/install/)
*   **~100GB of free space on disk** for assets downloading and extraction.

> Note: Docker engine and compose are included in Docker Desktop.

Before getting started, be sure to clone the repository and initialize the submodules:

```bash
git clone https://github.com/ArknightsRussian/KaltsitWebsite.git
cd KaltsitWebsite
git submodule update --init --recursive
