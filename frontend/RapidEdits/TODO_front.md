UI
- Context menu, aware of the current screen real estate it would take, adjust its position to fit the screen
- Tooltip, aware of the current screen real estate it would take, adjust its position to fit the screen
- Make an active state for stuff like the snapping button, we need to rework all the <button> elements with our own component for homogeneity
- Drag media be more friendly for the user,
- drag and drop into the track should show a preview of the media, what it would look like in the track (not so much to not overload cpu)

- Avatar / Avatar Group for collaboration purposes
- Make a chat for collaboration purposes
- Make a custom cursor with colors


Engine : 

- Create the split functionnality for the timeline, make it possible to extend to events, for collab/backend sync
- Split and also a razor tool, for like a razorblade in order to keep the "split mode" active, make it possible to extend to events, for collab/backend sync
- Add ctrl +/- for zooming in and out of timeline and preview seperately

- Start trying to export the project to a video file, using the timeline. Either frame by frame or using a video encoder. Having a preview of the video frame being rendered would be nice. If using GPU, its even better using Three.js to encode the video frame.

- REFACTOR

2nd step :
- Add properties panel functionnality, each type of object should have its own properties panel, like its own options, that it can control via a common interface, make it possible to extend to events, for collab/backend sync

- Add a way to create custom objects, with their own properties panel, and their own options, that it can control via a common interface, make it possible to extend to events, for collab/backend sync

- Add text 2D/3D Texts, with properties like scale, rotation, position, color, opacity, font, shadow, outline, material (image), etc.

- Add effects, like blur, color grading, using GLSL shaders, and properties to control them, make it possible to extend to events, for collab/backend sync

- Add transitions, like fade, slide, etc.
- Add a way to create custom transitions, with their own properties panel, and their own options, that it can control via a common interface, make it possible to extend to events, for collab/backend sync

> Collaboration

Backend : 
- Add register/login with better-auth-nextjs thingy
- Make it a cool register/login page, make it possible to access without account.
- When launching the app, send an heartbeat to the backend to check if the user is still logged in or if the backend/database is still up, if it is not, avoid making any more requests, and show an offline little status icon in the top left, showing that the app is not connected to the backend/database.
- Make it possible to try to reconnect and resync to the DB if needed. Any action would be made in frontend at first, and sent to the backend to be saved.
- Make User schema, with properties like name, email, etc.
- Make Project schema, with properties like name, description, etc. (also add collaboration roles etc...) each project will have seperated data, and seperated media, as well as seperated collaborators.

- Basically just making the data persist, and use diskStorage for a similar to a cloud storage, make it extensible to a real cloud storage CDN like AWS S3 or Google Cloud Storage if user wants.

- Setup handshake for collaboration.