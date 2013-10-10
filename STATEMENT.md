Statement of Purpose
====================

The goal of steganogify is to be a simple an reliable tool to store messages in animated GIFs. steganogify is built as a pure JS app with no server component, using HTML5 standards. It runs entirely inside a browser via a drag-and-drop interface.

Some use cases of steganogify that may help creators, viewers, and collectors of GIFs:
- add author, title, year, and statement to a GIF
- add RSA public keys to a GIF to create a limited-edition release
- create unexpected situations to be appreciated in the future
- advance the state of the art of GIF collecting

The algorithm used to encode messages in the GIF takes advantage of the indexed color palette used by GIFs, particularly that different indexes can address the same color. This allows variation in the bytes without corresponding visual variation, so that GIFs with messages look no different that GIFs without messages. The initial algorithm (v0) relies on an underused palette. GIFs force power-of-two palettes, which may have unused indexes that can be exploited.

