# Version 4.0.0

Prepared for release; not yet published to GitHub or GreasyFork.

The live Torn map stays above a persistent tab workspace. Drivers, Car, Info, History, Stats, Export and Settings use the same area beneath it. Driver details open in a separate inspector. The race information control remains in the map header.

Settings now use a **Save** button. All form fields are checked before saving; invalid input produces an error and receives focus without partially writing other form values or replacing them with defaults. Saving invalidates cached race-data views so updated API credentials and history limits take effect.

API handling reports malformed JSON and invalid JSON response shapes. HTTP failures retain their status codes for rate-limit handling.

The release restores the published userscript name, namespace and GreasyFork update URLs. Existing configuration storage keys are retained. Disable the separately installed v4 Preview when switching to this release.

Verification: syntax check and 40 automated tests pass. Live Torn/PDA verification of the release fixes remains pending. Twelve supplied live screenshots replace the old images. Historical preview notes describe earlier builds and their testing limitations.

Car completion detection now also recognizes Torn hiding its native race-action links and replacing Current car with Race info. Car becomes unavailable at completion, and an active Car view switches to Drivers. Other selected tabs remain selected.
