# Environmental Stewardship Module Outline

## 1. Field Research & Overview
Environmental Stewardship focuses on providing tools that help individuals and communities interact with their local environment responsibly. The goal is to move from passive awareness to active, data-driven participation in sustainability and conservation efforts.

Key areas identified:
- **Resource Sharing Networks:** Reducing waste and consumption through the localized sharing of goods and materials.
- **Sustainability Tracking Tools:** Applications that help individuals or groups measure, visualize, and reduce their ecological footprint.
- **Citizen Science Platforms:** Tools that engage community members in data collection for environmental monitoring (e.g., air quality, biodiversity).

## 2. Impactful & Approachable Development Options

### Option A: Localized Foraging & Gleaning Map
**Concept:** A collaborative, map-based tool where users can log public food sources (fruit trees on public land) or farmers can post gleaning opportunities (harvesting leftover crops).
**Impact:** Reduces food waste and connects people to local, sustainable food sources.
**Approachability:** Medium. Requires integration with mapping libraries and geospatial data handling.

### Option B: Household Sustainability Dashboard
**Concept:** A tracking tool where users can log their energy, water, or waste metrics and see aggregate community reductions.
**Impact:** Encourages behavior change through data visualization and positive community reinforcement.
**Approachability:** High. Primarily involves forms for data entry and charting libraries for visualization.

### Option C: Citizen Science Observation Logger
**Concept:** A mobile-friendly web app allowing users to snap photos and log data points (e.g., invasive species sightings, water levels, trash accumulation) to a public dataset.
**Impact:** Empowers communities to gather actionable data to present to local governments or conservation groups.
**Approachability:** Medium. Involves handling image uploads, EXIF data extraction (for location/time), and basic form submission.

## 3. Development Outlines & Referenced Documentation

### Outline for Localized Foraging Map (Option A)

**Architecture:**
- **Frontend:** Integration with an open-source mapping library (e.g., Leaflet).
- **Backend:** Node.js/SQLite storing points of interest with coordinates.
- **Data Model:** `Location` (id, latitude, longitude, type, description, addedBy).

**Development Steps:**
1. Setup a basic map view using Leaflet and OpenStreetMap tiles.
2. Create an API endpoint to retrieve locations within a specific bounding box.
3. Build a form to add new markers to the map.

**Referenced Documentation:**
- [Leaflet.js Documentation](https://leafletjs.com/)
- [OpenStreetMap Usage Policy](https://operations.osmfoundation.org/policies/tiles/)

### Outline for Sustainability Dashboard (Option B)

**Architecture:**
- **Frontend:** Uses a charting library (e.g., Chart.js or D3.js).
- **Data Model:** `Metric` (id, userId, category, value, date). Data is kept private to the user via `core-agency`, but users can opt-in to anonymous community aggregation.

**Development Steps:**
1. Build input forms for tracking various metrics (e.g., kWh of electricity).
2. Write SQL queries to aggregate data over time (weekly/monthly).
3. Implement charts to visualize personal trends and an aggregated community goal progress bar.

**Referenced Documentation:**
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [SQL Grouping and Aggregation Functions](https://www.sqlite.org/lang_aggfunc.html)

### Outline for Citizen Science Logger (Option C)

**Architecture:**
- **Frontend:** PWA with camera access via the HTML5 Media Capture API.
- **Backend:** File storage system for images and SQLite for observation metadata.
- **Data Model:** `Observation` (id, userId, category, imagePath, latitude, longitude, notes, timestamp).

**Development Steps:**
1. Implement the camera interface in the browser.
2. Extract geolocation data using the Geolocation API (with explicit user consent).
3. Build the backend to receive the image, save it to the filesystem, and record the metadata in SQLite.

**Referenced Documentation:**
- [MDN Web Docs: Media Capture and Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API)
- [MDN Web Docs: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
