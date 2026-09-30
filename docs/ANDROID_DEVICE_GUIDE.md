# 📱 Android Device Setup & Troubleshooting Guide

Peep interacts directly with Android physical devices, local emulators, remote device farms, and headless cloud containers via the Android Debug Bridge (`adb`). 

This guide provides an exhaustive reference for:
- Auto-discovery and explicit device targeting
- Emulator port mapping (Android Studio, MuMu, BlueStacks, Nox, LDPlayer, Genymotion, WSA)
- The critical architectural difference between **ADB Daemon Port** and **Device Sockets**
- USB and Wireless Wi-Fi debugging with auto-reconnect
- Remote ADB daemon setups for CI/CD and Docker
- Troubleshooting device states (`device`, `unauthorized`, `offline`, missing devices)

---

## ⚡ Quick Start: Zero-Config Auto-Discovery

If you have a **single Android device or emulator running**, Peep requires **zero configuration**.

1. Start your emulator or plug in your physical device via USB.
2. Verify Peep detects it:
   ```bash
   npx peep-mcp devices
   ```
3. Run the system diagnostic:
   ```bash
   npx peep-mcp doctor
   ```

Peep queries ADB (`adb devices -l`), filters for online targets with state `device`, queries display resolution via `wm size`, and auto-binds to the active target.

---

## 🧭 How Peep Selects Devices

```
                        ┌─────────────────────────────────┐
                        │   1. Check PEEP_DEVICE_ID /     │
                        │      target.android.deviceId    │
                        └────────────────┬────────────────┘
                                         │
                   Specified? ───────────┴─────────── No?
                   │                                    │
                   ▼                                    ▼
       ┌───────────────────────┐           ┌─────────────────────────┐
       │ Bind to explicit      │           │ Check connectAddress /  │
       │ serial / socket ID    │           │ PEEP_CONNECT_ADDRESS    │
       └───────────────────────┘           └────────────┬────────────┘
                                                        │
                                          Specified? ───┴─── No?
                                          │                    │
                                          ▼                    ▼
                              ┌──────────────────────┐  ┌───────────────────────┐
                              │ Run `adb connect`    │  │ Run `adb devices -l`  │
                              │ and bind to address  │  │ & filter status=device│
                              └──────────────────────┘  └──────────┬────────────┘
                                                                   │
                                                                   ▼
                                                        ┌───────────────────────┐
                                                        │ Auto-select 1st       │
                                                        │ online device         │
                                                        └───────────────────────┘
```

### Specifying a Device

When multiple devices or emulators are connected (e.g., a phone and a tablet, or an emulator and a physical phone), specify the target device using any of these three methods:

#### 1. In MCP Configuration (`mcp_config.json`)
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_DEVICE_ID": "localhost:7555"
      }
    }
  }
}
```

#### 2. In `peep.yaml`
```yaml
target:
  android:
    deviceId: "emulator-5554"
```

#### 3. Via CLI Flag (`-d` / `--device`)
```bash
npx peep-mcp -d emulator-5554 tap "Log In"
npx peep-mcp -d localhost:7555 doctor
```

---

## ⚠️ Critical Distinction: ADB Daemon Port vs. Device Port

This is the **most common misconfiguration** encountered when setting up MCP servers for Android.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LOCAL WORKSTATION                             │
│                                                                        │
│   ┌────────────────────┐            ┌──────────────────────────────┐   │
│   │ Coding Agent / IDE │ ──(stdio)──│       Peep MCP Server        │   │
│   └────────────────────┘            └──────────────┬───────────────┘   │
│                                                    │                   │
│                                            (calls adb CLI)             │
│                                                    ▼                   │
│                                     ┌──────────────────────────────┐   │
│                                     │      ADB Server Daemon       │   │
│                                     │     Host: 127.0.0.1          │   │
│                                     │     Port: 5037 (adbPort)     │   │
│                                     └──────────────┬───────────────┘   │
└────────────────────────────────────────────────────┼───────────────────┘
                                                     │
                             (manages device sockets & USB links)
                                                     │
         ┌───────────────────┬───────────────────────┼───────────────────┐
         ▼                   ▼                       ▼                   ▼
┌─────────────────┐ ┌─────────────────┐     ┌─────────────────┐ ┌─────────────────┐
│ Android Studio  │ │   MuMu Player   │     │  BlueStacks 5   │ │ Physical Phone  │
│    Emulator     │ │    Emulator     │     │    Emulator     │ │   (USB / Wi-Fi) │
│  emulator-5554  │ │  localhost:7555 │     │  localhost:5555 │ │   RF8M10XXXXX   │
│   (deviceId)    │ │   (deviceId)    │     │   (deviceId)    │ │   (deviceId)    │
└─────────────────┘ └─────────────────┘     └─────────────────┘ └─────────────────┘
```

### The Difference Explained

| Setting | Purpose | Default | When to Change |
| :--- | :--- | :--- | :--- |
| **`adbHost`** / **`PEEP_ADB_HOST`** | Host where the **ADB Server Daemon** process runs. | `""` (local `127.0.0.1`) | **Only** if your ADB daemon runs on another machine (e.g. CI runner, remote Mac mini, EC2 container). |
| **`adbPort`** / **`PEEP_ADB_PORT`** | Port where the **ADB Server Daemon** listens for client requests. | `5037` | **Only** if you started ADB daemon with `adb -P <custom_port> server`. |
| **`deviceId`** / **`PEEP_DEVICE_ID`** | The serial number or TCP socket of the **target Android device/emulator**. | Auto-detected | Set to the specific emulator socket (e.g. `localhost:7555`) or USB serial (e.g. `RF8M10XXXXX`). |
| **`connectAddress`** / **`PEEP_CONNECT_ADDRESS`** | Network address of a remote/Wi-Fi Android device to auto-connect via `adb connect`. | `""` | Set to your phone's Wi-Fi IP (e.g. `192.168.1.100:5555`). |

> [!IMPORTANT]
> **For 99.9% of Users: Do NOT set `adbHost` or `adbPort`!**
> If you are running an emulator (like MuMu, BlueStacks, Nox, or Android Studio AVD) or a USB device on your computer, ADB handles the background daemon automatically on `127.0.0.1:5037`. You **only** need to configure `deviceId` (e.g. `localhost:7555`), or leave it empty for auto-detection! Setting `adbPort` to an emulator port will break ADB communication.

> [!CAUTION]
> **Common Trap**: Setting `adbPort: 7555` when using MuMu Player!
>
> MuMu Player listens on port `7555` as an **emulated device socket**, **not** an ADB server daemon. If you set `adbPort: 7555`, ADB executes `adb -P 7555 devices` and attempts to send ADB daemon protocol commands to the emulator, hanging indefinitely.
>
> **The Correct Configuration**:
> - Leave `adbPort` as `5037` (or omit it entirely).
> - Set `deviceId: "localhost:7555"` (or `127.0.0.1:7555`).

---

## 🕹️ Supported Emulators & Default Ports

Most third-party emulators expose their ADB interface on a dedicated local TCP port. Peep supports all standard emulators:

| Emulator | Default Socket / Serial | How to Connect Manually (if not detected) | Notes |
| :--- | :--- | :--- | :--- |
| **Android Studio AVD** | `emulator-5554` | Automatically registered by SDK | Increments by 2 for additional instances (`emulator-5556`, etc.) |
| **MuMu Player 6 & 12** | `127.0.0.1:7555` | `adb connect 127.0.0.1:7555` | Recommended for Windows/macOS high-performance testing |
| **BlueStacks 5** | `127.0.0.1:5555` | `adb connect 127.0.0.1:5555` | Requires **Enable Android Debug Bridge (ADB)** in BlueStacks Advanced Settings |
| **Nox Player** | `127.0.0.1:62001` | `adb connect 127.0.0.1:62001` | Additional instances use `62025`, `62026`, etc. |
| **LDPlayer 9** | `127.0.0.1:5555` | `adb connect 127.0.0.1:5555` | Multi-instance increments port |
| **Genymotion** | `127.0.0.1:6555` | `adb connect 127.0.0.1:6555` | Requires Genymotion ADB tool set to "Use custom Android SDK tools" |
| **Windows Subsystem for Android (WSA)** | `127.0.0.1:58526` | `adb connect 127.0.0.1:58526` | Port displayed in WSA Settings > Developer |
| **Cloud Docker (redroid)** | `127.0.0.1:5555` | `adb connect <docker_host>:5555` | Headless GPU-accelerated cloud Android |

---

## 🔌 Physical Device Setup

### 1. Enable Developer Options & USB Debugging
1. On your Android device, open **Settings**.
2. Navigate to **About Phone** (or **System > About Phone**).
3. Tap **Build Number** 7 times rapidly until you see the toast: *"You are now a developer!"*.
4. Return to **Settings > System > Developer Options**.
5. Enable the following toggles:
   - **USB Debugging**: Required for ADB commands.
   - **USB Debugging (Security settings)**: Required on MIUI/HyperOS, ColorOS, and OxygenOS to allow tapping/gestures via ADB.
   - **Disable adb authorization timeout**: Recommended to avoid unexpected key expiry.

### 2. Connect via USB & Authorize
1. Connect your phone to your computer with a high-quality data cable (not charge-only).
2. Look at your phone's screen. A dialog will appear: **"Allow USB debugging?"**.
3. Check **"Always allow from this computer"** and tap **Allow**.
4. Run `npx peep-mcp devices` to confirm:
   ```
   Attached Android Devices & Emulators:
   Serial / Socket         │ State          │ Model    │ Product
   RF8M10XXXXX [SELECTED]  │ device (ready) │ SM_S908U │ b0q
   ```

---

## 📶 Wireless (Wi-Fi) Debugging

Peep can interact with physical devices over Wi-Fi, eliminating USB cable constraints.

### Method A: Wireless Debugging via Pairing (Android 11+)
1. Ensure your computer and Android device are on the **same Wi-Fi network**.
2. Go to **Settings > Developer Options > Wireless Debugging** and toggle it **On**.
3. Tap **Pair device with pairing code**.
4. Note the **IP address**, **Port**, and **6-digit pairing code** shown on the screen (e.g., `192.168.1.150:41235`).
5. Run the pairing command from your terminal:
   ```bash
   adb pair 192.168.1.150:41235
   # Enter the 6-digit pairing code when prompted
   ```
6. Return to the main Wireless Debugging screen on your phone to find the **connection IP and Port** (e.g., `192.168.1.150:38941`).
7. Connect to the device:
   ```bash
   adb connect 192.168.1.150:38941
   ```
8. In Peep, set `PEEP_DEVICE_ID="192.168.1.150:38941"`.

### Method B: Switching USB Device to Wi-Fi Mode (Android 10 and below)
1. Plug your phone into your computer via USB.
2. Tell the device daemon to listen on port `5555`:
   ```bash
   adb tcpip 5555
   ```
3. Find your phone's Wi-Fi IP address (in **Settings > About Phone > Status information > IP address**).
4. Unplug the USB cable.
5. Connect via TCP:
   ```bash
   adb connect 192.168.1.100:5555
   ```
6. Peep configuration:
   ```yaml
   target:
     android:
       connectAddress: "192.168.1.100:5555"
   ```
   *When `connectAddress` is set, Peep automatically executes `adb connect` during startup and re-establishes the connection if dropped.*

---

## 🌐 Remote ADB Server (Docker, CI/CD, Device Farms)

If your test runners or AI agents run inside Docker containers, WSL2, or a remote cloud VM while the Android devices/emulators run on a separate host machine:

### 1. Expose ADB Server Daemon on Host
On the machine with the attached devices/emulators:
```bash
# Kill existing local server
adb kill-server

# Start daemon bound to all network interfaces (-a)
adb -a -P 5037 nodaemon server
```

### 2. Configure Peep in Client / CI Container
In your client container or coding harness configuration:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_ADB_HOST": "192.168.1.50",
        "PEEP_ADB_PORT": "5037",
        "PEEP_DEVICE_ID": "emulator-5554"
      }
    }
  }
}
```

Peep will route all ADB commands through the remote server (`adb -H 192.168.1.50 -P 5037 ...`).

---

## 👥 Multi-Device Orchestration

You can control multiple devices simultaneously by registering separate Peep MCP instances with distinct `PEEP_DEVICE_ID` environment variables.

### Example: Phone + Tablet in Antigravity or Cursor

In `mcp_config.json`:
```json
{
  "mcpServers": {
    "peep-phone": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_DEVICE_ID": "RF8M10XXXXX"
      }
    },
    "peep-tablet": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_DEVICE_ID": "localhost:7555"
      }
    }
  }
}
```

Now your AI agent has access to both targets independently:
- `peep-phone_find_and_tap({ target: "Login" })`
- `peep-tablet_find_and_tap({ target: "Split View Toggle" })`

---

## 🛠️ Troubleshooting Device States

Run `npx peep-mcp devices` to inspect the state of all attached devices:

### 1. State: `device` (Ready)
```
localhost:7555 [AUTO-SELECTED] │ device (ready) │ SM_S908N │ b0q
```
Everything is operational. Peep can capture screens, parse the UI hierarchy, inject gestures, and stream logs.

---

### 2. State: `unauthorized`
```
RF8M10XXXXX │ unauthorized │ - │ -
```
**Cause**: The phone hasn't accepted the computer's RSA debugging key.
**Remedy**:
1. Unlock the phone screen.
2. Look for the **"Allow USB debugging?"** prompt.
3. Check **"Always allow from this computer"** and tap **Allow**.
4. If no prompt appears:
   - Unplug and reconnect the USB cable.
   - Go to **Developer Options > Revoke USB debugging authorizations**, tap OK, and reconnect.
   - Restart the ADB server: `adb kill-server && adb start-server`.

---

### 3. State: `offline`
```
192.168.1.100:5555 │ offline │ - │ -
```
**Cause**: The connection was interrupted, Wi-Fi dropped packets, or the device fell into deep sleep.
**Remedy**:
1. Run `adb reconnect` or `adb disconnect <address> && adb connect <address>`.
2. Wake up the device screen.
3. Restart ADB server: `adb kill-server && adb start-server`.

---

### 4. `No devices or emulators detected via ADB`
```
No devices or emulators detected via ADB.
```
**Checklist**:
1. **Is the USB cable data-capable?** Many cables are charging-only and lack D+/D- data lines.
2. **Is USB Debugging toggled ON?** Check **Settings > Developer Options**.
3. **Windows USB Drivers**: Ensure the OEM Android USB Driver is installed (via Android Studio SDK Manager > SDK Tools > Google USB Driver).
4. **Linux `udev` rules**: If running on Linux/Ubuntu, ensure `android-udev-rules` is installed:
   ```bash
   sudo apt-get install android-sdk-platform-tools-common
   # or install via github.com/M0Rf30/android-udev-rules
   ```
5. **Is the emulator actually running?** Emulators must be booted past the Android home screen before the ADB socket accepts connections.

---

## 📋 Configuration Summary Reference

| Property | Environment Variable | CLI Option | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `PEEP_DEVICE_ID` | `-d`, `--device` | `""` (auto) | Explicit device serial (e.g. `emulator-5554` or `127.0.0.1:7555`) |
| `adbPath` | `PEEP_ADB_PATH` | `--adb-path` | `"adb"` | Custom path to the `adb` executable |
| `adbHost` | `PEEP_ADB_HOST` | `--adb-host` | `""` | Remote ADB daemon host (`-H <host>`) |
| `adbPort` | `PEEP_ADB_PORT` | `--adb-port` | `5037` | Remote ADB daemon port (`-P <port>`) |
| `connectAddress` | `PEEP_CONNECT_ADDRESS` | `--connect` | `""` | Device network address to auto-connect via `adb connect` |
| `scrcpyPath` | `PEEP_SCRCPY_PATH` | `--scrcpy-path` | `"scrcpy"` | Optional custom path to `scrcpy` binary |
