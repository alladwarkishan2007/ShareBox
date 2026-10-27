import L from 'leaflet';
import { locationService } from '../services/location.service.js';
import { toast } from './toast.js';
import { escapeHTML } from '../utils/sanitize.js';

export class MapPickerModal {
  constructor() {
    this.modalEl = null;
    this.map = null;
    this.meetingMarker = null;
    this.currentPosition = null;
    this.selectedPoint = null;
  }

  async open({ currentMeetingPoint, onSelect }) {
    const landmarks = await locationService.getCampusLandmarks();
    const defaultCoords = locationService.getDefaultCentroid();

    const initialLat = currentMeetingPoint?.lat || defaultCoords.lat;
    const initialLng = currentMeetingPoint?.lng || defaultCoords.lng;
    const initialLabel = currentMeetingPoint?.label || 'Campus Meeting Point';

    this.selectedPoint = {
      lat: initialLat,
      lng: initialLng,
      label: initialLabel,
      time: currentMeetingPoint?.time || ''
    };

    // Create Modal DOM
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-container active';
    this.modalEl.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog" style="max-width: 680px;">
        <div class="modal-header">
          <h3 class="text-md font-bold">Pick Meeting Point</h3>
          <button class="btn btn-icon close-map-btn" aria-label="Close">✕</button>
        </div>

        <div class="modal-body" style="padding: var(--space-4);">
          <!-- Privacy Notice -->
          <div style="background: var(--color-info-light); border-left: 4px solid var(--color-info); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: var(--font-xs); color: var(--color-info-border);">
            <strong style="color: #0369a1;">Privacy Guarantee:</strong>
            <span style="color: #0369a1;"> Your location is fetched only once on demand. We never use continuous tracking or store your live GPS movements.</span>
          </div>

          <!-- Quick Action Bar -->
          <div class="flex gap-2 items-center" style="margin-bottom: 10px;">
            <button id="gps-locate-btn" class="btn btn-secondary btn-sm" type="button">
              Use My Location (One-Time)
            </button>
            <div class="flex-1">
              <select id="landmark-select" class="form-select" style="padding: 4px 8px; font-size: var(--font-xs);">
                <option value="">-- Jump to Campus Landmark --</option>
                ${landmarks.map(lm => `
                  <option value="${lm.lat},${lm.lng},${escapeHTML(lm.name)}">${escapeHTML(lm.name)} (${escapeHTML(lm.category)})</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Leaflet Map Container -->
          <div id="leaflet-picker-map" class="map-picker-container" style="height: 320px;"></div>

          <!-- Meeting Point Details Input -->
          <div class="flex gap-3" style="margin-top: 12px;">
            <div class="form-group flex-1" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: var(--font-xs);">Location Description / Note</label>
              <input type="text" id="point-label-input" class="form-input" value="${escapeHTML(initialLabel)}" placeholder="e.g. Near Library front steps...">
            </div>
            <div class="form-group" style="width: 160px; margin-bottom: 0;">
              <label class="form-label" style="font-size: var(--font-xs);">Meeting Time (Optional)</label>
              <input type="time" id="point-time-input" class="form-input" value="${escapeHTML(this.selectedPoint.time || '')}">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary close-map-btn" type="button">Cancel</button>
          <button id="confirm-point-btn" class="btn btn-primary" type="button">Propose Meeting Point</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Initialize Leaflet Map
    setTimeout(() => {
      this.initMap(initialLat, initialLng, landmarks);
    }, 100);

    // Event Bindings
    const closeBtns = this.modalEl.querySelectorAll('.close-map-btn');
    closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

    const locateBtn = this.modalEl.querySelector('#gps-locate-btn');
    locateBtn.addEventListener('click', async () => {
      locateBtn.disabled = true;
      locateBtn.textContent = 'Locating...';
      try {
        const pos = await locationService.getOneTimePosition();
        this.currentPosition = pos;
        this.updateMarker(pos.lat, pos.lng, 'My One-Time Position');
        this.map.setView([pos.lat, pos.lng], 18);
        this.modalEl.querySelector('#point-label-input').value = 'Near my current spot';
        this.selectedPoint.label = 'Near my current spot';
        toast.success('Centered on your one-time position.');
      } catch (err) {
        toast.warning(err.message);
      } finally {
        locateBtn.disabled = false;
        locateBtn.textContent = 'Use My Location (One-Time)';
      }
    });

    const landmarkSelect = this.modalEl.querySelector('#landmark-select');
    landmarkSelect.addEventListener('change', (e) => {
      if (!e.target.value) return;
      const [lat, lng, name] = e.target.value.split(',');
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);
      this.updateMarker(numLat, numLng, name);
      this.map.setView([numLat, numLng], 18);
      this.modalEl.querySelector('#point-label-input').value = name;
      this.selectedPoint.label = name;
    });

    const confirmBtn = this.modalEl.querySelector('#confirm-point-btn');
    confirmBtn.addEventListener('click', () => {
      const labelInput = this.modalEl.querySelector('#point-label-input').value.trim();
      const timeInput = this.modalEl.querySelector('#point-time-input').value;

      this.selectedPoint.label = labelInput || 'Campus Meeting Spot';
      this.selectedPoint.time = timeInput || null;

      if (onSelect) {
        onSelect(this.selectedPoint);
      }
      this.close();
    });
  }

  initMap(lat, lng, landmarks) {
    const mapEl = document.getElementById('leaflet-picker-map');
    if (!mapEl) return;

    this.map = L.map(mapEl).setView([lat, lng], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Add Landmark markers
    landmarks.forEach(lm => {
      const lmMarker = L.circleMarker([lm.lat, lm.lng], {
        radius: 7,
        fillColor: '#0284c7',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      lmMarker.bindPopup(`<strong>${escapeHTML(lm.name)}</strong><br><small>${escapeHTML(lm.category)}</small>`);
      lmMarker.on('click', () => {
        this.updateMarker(lm.lat, lm.lng, lm.name);
        const labelInput = this.modalEl.querySelector('#point-label-input');
        if (labelInput) labelInput.value = lm.name;
      });
    });

    // Create Draggable Pin for Meeting Spot
    this.meetingMarker = L.marker([lat, lng], {
      draggable: true
    }).addTo(this.map);

    this.meetingMarker.bindPopup('Drag to fine-tune meeting point').openPopup();

    this.meetingMarker.on('dragend', (event) => {
      const pos = event.target.getLatLng();
      this.selectedPoint.lat = pos.lat;
      this.selectedPoint.lng = pos.lng;
    });

    // Click on map moves marker
    this.map.on('click', (e) => {
      this.updateMarker(e.latlng.lat, e.latlng.lng, this.selectedPoint.label);
    });
  }

  updateMarker(lat, lng, label) {
    this.selectedPoint.lat = lat;
    this.selectedPoint.lng = lng;
    this.selectedPoint.label = label;
    if (this.meetingMarker) {
      this.meetingMarker.setLatLng([lat, lng]);
    }
  }

  close() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
