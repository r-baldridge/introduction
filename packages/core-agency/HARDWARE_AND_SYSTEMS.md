# Hardware and Systems Options for Privacy & Security

This document outlines options for personal hardware and open-source software to produce local, encrypted, offline backed-up, and air-gapped systems for varying levels of personal data security. These systems are designed to be firewalled and VPN-proxied to privacy-preserving servers when online access is needed, ensuring the system retains full control over all private information.

## 1. Hardware Options

### Personal Hardware for Local Processing
- **Raspberry Pi 4 / 5:** Low-cost, low-power devices ideal for running local network services (e.g., Pi-hole, local file sharing, personal VPN servers).
- **Mini-PCs (e.g., Intel NUC, Beelink):** More powerful than a Raspberry Pi, suitable for running hypervisors (Proxmox, XCP-ng) to host multiple isolated virtual machines (VMs) for different tasks (e.g., one VM for secure local storage, one for a proxy gateway).
- **Dedicated Hardware Firewalls (e.g., Protectli, Netgate):** Essential for edge security, allowing fine-grained control over inbound and outbound traffic.

### Air-Gapped and Backup Hardware
- **Old Laptops/Desktops:** Repurposed hardware with physical networking components (Wi-Fi cards, Ethernet ports) removed or disabled at the BIOS/hardware level to ensure true air-gapping.
- **External Encrypted Drives:** Hardware-encrypted USB drives (e.g., Apricorn Aegis) or software-encrypted standard drives (using LUKS or Veracrypt) for offline, cold storage of critical data and backups.

## 2. Open-Source Software Options

### Operating Systems & Hypervisors
- **Qubes OS:** A security-oriented desktop operating system that uses Xen virtualization to isolate different tasks (e.g., work, personal, banking) into separate "qubes," preventing compromise in one area from affecting others.
- **Tails (The Amnesic Incognito Live System):** A portable OS that routes all traffic through Tor and leaves no trace on the host machine, perfect for highly sensitive, temporary tasks.
- **Proxmox VE / XCP-ng:** Open-source hypervisors for managing VMs and containers, allowing segmentation of services on mini-PCs or home servers.

### Networking & Edge Security
- **OPNsense / pfSense:** Open-source firewall and routing software to manage network traffic, implement strict egress filtering, and host VPNs.
- **WireGuard / OpenVPN:** Protocols for establishing secure, encrypted tunnels between local devices and privacy-preserving servers. WireGuard is preferred for its modern cryptography and performance.
- **Pi-hole / AdGuard Home:** Network-level DNS sinkholes to block ads, trackers, and malicious domains before they reach devices.

### Local Services & Data Management
- **Nextcloud:** A self-hosted cloud storage solution for file synchronization, calendar, and contacts, replacing centralized services like Google Drive or iCloud.
- **Syncthing:** A decentralized file synchronization tool that syncs files directly between devices without relying on a central server.
- **Vaultwarden / Bitwarden:** Self-hosted password managers for secure credential storage.

## 3. Network Architecture & Connectivity

To maintain control over private info while allowing necessary online access, the network architecture should employ a defense-in-depth approach:

1.  **Local Network Segmentation:** Use VLANs on the firewall to separate IoT devices, guest networks, and highly secure personal devices.
2.  **Strict Egress Filtering:** By default, block all outbound traffic from the secure VLAN. Only allow required protocols (e.g., HTTPS, WireGuard) to the dedicated VPN gateway, and let that gateway manage connectivity to external VPN providers. If direct connections to providers such as Mullvad or ProtonVPN are required, prefer provider-published endpoint lists or DNS names and document the operational upkeep needed to keep those rules current.
3.  **VPN Proxy Gateway:** Route all traffic from the secure network through a dedicated VPN gateway VM. This helps protect traffic from ISP/LAN/on-path observers and masks the source IP from remote services, but it does not mitigate compromise of the local device itself: a compromised host can still exfiltrate data through the VPN tunnel.
4.  **Air-Gapped Workstations:** For the most sensitive data (e.g., cryptographic keys, personal journals), use a dedicated, air-gapped machine. Data transfer should only occur via dedicated transfer media that is freshly formatted and verified for that purpose, scanned on a sacrificial intermediary system, and validated with hashes or signatures before import; for higher-assurance workflows, prefer write-once media or QR-based transfer where feasible.

## 4. Data De-identification and Obfuscation Methods

To preserve user privacy without sacrificing significant result accuracy when interacting with external services, the system should implement several layers of obfuscation:

- **Local Pre-processing & Scrubbing:** All user data is processed locally before being relayed online. This includes stripping metadata (e.g., EXIF data from photos), applying best-effort de-identification for unstructured text using local NLP models, using deterministic redaction for structured fields where possible, and aggregating data points. Because automated PII detection can produce false negatives and false positives, high-risk disclosures should be manually reviewed before any data is shared externally.
- **Traffic Padding & Rate Shaping:** To reduce the visibility of behavioral patterns, prefer infrastructure-level controls such as VPN-level traffic shaping, constant-rate tunneling where appropriate, fixed-size message batching, or cover traffic generated only within systems you control. Avoid recommending decoy searches, random downloads, or other artificial requests to third-party services, as these may violate laws, ethics, acceptable-use policies, or service terms and can trigger abuse controls or create unnecessary bandwidth and operational impact.
- **Differential Privacy / Noise Injection:** When sharing aggregated data or statistics (e.g., for community research), add mathematically calibrated noise to the dataset. This ensures individual records cannot be identified while maintaining the statistical validity of the aggregate results.
- **K-Anonymity / L-Diversity:** Ensure that any shared dataset contains at least 'k' individuals with the same quasi-identifiers, making it difficult to single out a specific person.

By combining these hardware, software, and obfuscation techniques, users can achieve a high degree of self-determination and privacy, fully embodying the principles of the `core-agency` module.
