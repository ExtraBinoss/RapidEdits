
import { desktopCapturer } from 'electron';

async function testSources() {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 150, height: 100 } });
  console.log('Found sources:', sources.length);
  sources.forEach(s => {
    console.log(`- ${s.name} (id: ${s.id}) - Thumbnail: ${s.thumbnail ? s.thumbnail.isEmpty() ? 'Empty' : 'Present' : 'None'}`);
  });
}

testSources();
