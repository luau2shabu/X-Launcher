// UI strings in Thai and English. t('key', {var}) fills {var} placeholders.

const STRINGS = {
  th: {
    'tab.search': 'ค้นหา', 'tab.home': 'สำหรับคุณ', 'tab.movies': 'ภาพยนตร์', 'tab.shows': 'รายการทีวี', 'tab.apps': 'แอป', 'tab.library': 'คลังของฉัน',
    'row.apps': 'แอปของคุณ', 'row.continue': 'ดูต่อ', 'row.picks': 'แนะนำสำหรับคุณ', 'row.recent': 'เพิ่มล่าสุดใน {name}',
    'row.recentMovies': 'ภาพยนตร์ที่เพิ่มล่าสุด', 'row.recentShows': 'ตอนใหม่และรายการที่เพิ่มล่าสุด',
    'row.related': 'เนื้อหาที่คล้ายกัน', 'row.libraries': 'คลังสื่อ', 'row.allApps': 'แอปทั้งหมด', 'row.episodes': 'ตอน',
    'row.movies': 'ภาพยนตร์', 'row.shows': 'รายการทีวี', 'row.searchApps': 'แอป', 'row.searchEpisodes': 'ตอน',
    'hero.new': 'ใหม่ใน {name}', 'hero.cta': 'ดูรายละเอียด',
    'hero.welcomeTitle': 'ยินดีต้อนรับสู่ X Launcher',
    'hero.welcomeText': 'เปิดแอปโปรดจากแถวด้านล่าง หรือเชื่อมต่อ Plex เพื่อให้หนังและซีรีส์ของคุณขึ้นที่นี่',
    'apps.add': 'เพิ่มแอป', 'apps.addProgram': 'เพิ่มโปรแกรม (.exe)', 'apps.addWebsite': 'เพิ่มเว็บไซต์',
    'apps.showHidden': 'แสดงแอปที่ซ่อน ({n})', 'apps.hideHidden': 'ซ่อนแอปที่ซ่อนไว้',
    'apps.open': 'เปิด', 'apps.addFav': 'เพิ่มไปยังแอปของคุณ', 'apps.removeFav': 'นำออกจากแอปของคุณ', 'apps.move': 'ย้ายตำแหน่ง',
    'apps.hide': 'ซ่อนแอป', 'apps.unhide': 'เลิกซ่อน', 'apps.remove': 'ลบทางลัดนี้', 'apps.opening': 'กำลังเปิด {name}…',
    'apps.moveHint': 'กด ← → เพื่อย้าย แล้วกด OK', 'apps.added': 'เพิ่ม {name} แล้ว', 'apps.removed': 'นำ {name} ออกแล้ว',
    'apps.hidden': 'ซ่อน {name} แล้ว', 'apps.emptyFav': 'ยังไม่มีแอปในแถวนี้ — ไปที่แท็บแอป กดค้างที่แอป แล้วเลือก "เพิ่มไปยังแอปของคุณ"',
    'apps.websiteUrl': 'ที่อยู่เว็บไซต์', 'apps.websiteName': 'ชื่อที่จะแสดง', 'apps.howOpen': 'จะเปิดเว็บไซต์นี้แบบไหน',
    'apps.tvMode': 'โหมด TV (เหมาะกับรีโมท)', 'apps.tvModeHint': 'ใช้หน้าเว็บแบบสมาร์ททีวี เช่น YouTube',
    'apps.normalMode': 'เว็บไซต์ปกติ', 'apps.normalModeHint': 'เปิดเต็มจอใน Microsoft Edge',
    'apps.website': 'เว็บไซต์', 'apps.program': 'โปรแกรม', 'apps.store': 'Microsoft Store', 'apps.desktop': 'แอป Windows',
    'details.play': 'เล่น', 'details.resume': 'เล่นต่อจาก {time}', 'details.startOver': 'เริ่มใหม่', 'details.playEp': 'เล่น {ep}',
    'details.markWatched': 'ดูแล้ว', 'details.markUnwatched': 'ยังไม่ได้ดู', 'details.director': 'ผู้กำกับ', 'details.cast': 'นักแสดง',
    'details.left': 'เหลือ {time}', 'details.seasons': '{n} ซีซัน', 'details.episodes': '{n} ตอน', 'details.season': 'ซีซัน {n}',
    'play.opening': 'กำลังเปิดใน Plex HTPC…', 'play.opened': 'เปิด Plex HTPC แล้ว เลือกเรื่องต่อในแอปได้เลย', 'play.failed': 'เล่นไม่สำเร็จ: {msg}',
    'search.placeholder': 'ค้นหาหนัง รายการ และแอป', 'search.hint': 'พิมพ์ด้วยแป้นด้านซ้าย หรือคีย์บอร์ดด้านหลังรีโมท',
    'search.none': 'ไม่พบผลลัพธ์สำหรับ "{q}"', 'search.searching': 'กำลังค้นหา…',
    'key.space': 'เว้นวรรค', 'key.clear': 'ล้าง', 'key.search': 'ค้นหา', 'key.ok': 'ตกลง', 'key.lang': 'ABC', 'key.symbols': '.com',
    'sort.title': 'ชื่อเรื่อง', 'sort.added': 'เพิ่มล่าสุด', 'sort.year': 'ปีที่ออก', 'sort.rating': 'คะแนน', 'filter.unwatched': 'ยังไม่ดู',
    'library.items': '{n} รายการ', 'library.empty': 'ยังไม่มีคลังสื่อจาก Plex',
    'plex.offlineTitle': 'ยังไม่ได้เชื่อมต่อ Plex', 'plex.offlineText': 'ตรวจว่า Plex Media Server เปิดอยู่ แล้วกดรีเฟรชในการตั้งค่า > Plex',
    'settings.title': 'การตั้งค่า', 'settings.profile': 'โปรไฟล์', 'settings.language': 'ภาษา',
    'settings.plex': 'Plex', 'settings.plexServers': '{n} เซิร์ฟเวอร์', 'settings.plexNone': 'ไม่ได้เชื่อมต่อ',
    'settings.serverThisPc': 'เครื่องนี้', 'settings.serverOwned': 'เซิร์ฟเวอร์ของคุณ', 'settings.serverShared': 'แชร์กับคุณ',
    'settings.plexRefresh': 'รีเฟรชเซิร์ฟเวอร์', 'settings.plexAccount': 'รวมเซิร์ฟเวอร์ที่แชร์กับบัญชี Plex', 'settings.plexLibraries': 'คลังสื่อที่แสดง',
    'settings.apps': 'แอป', 'settings.appsRefresh': 'โหลดรายการแอปใหม่', 'settings.appsHidden': 'แอปที่ซ่อนอยู่ ({n})',
    'settings.ambient': 'โหมดพักหน้าจอ', 'settings.ambientOn': 'เปิดใช้งาน', 'settings.ambientWait': 'เริ่มเมื่อไม่ได้ใช้งาน',
    'settings.ambientSource': 'แหล่งภาพ', 'settings.ambientPlex': 'ภาพจาก Plex', 'settings.ambientFolder': 'โฟลเดอร์รูปภาพ',
    'settings.ambientChoose': 'เลือกโฟลเดอร์รูปภาพ', 'settings.ambientPreview': 'ดูตัวอย่างตอนนี้', 'settings.minutes': '{n} นาที',
    'settings.display': 'จอภาพและความละเอียด', 'settings.hdr': 'HDR', 'settings.sound': 'เสียง', 'settings.network': 'เครือข่าย',
    'settings.bluetooth': 'บลูทูธและรีโมท', 'settings.opensWindows': 'เปิดในการตั้งค่า Windows',
    'settings.power': 'พลังงาน', 'settings.sleep': 'พักเครื่อง', 'settings.restart': 'รีสตาร์ท', 'settings.shutdown': 'ปิดเครื่อง', 'settings.quit': 'ออกจาก X Launcher',
    'settings.confirm': '{action}เลยไหม', 'settings.about': 'เกี่ยวกับ', 'settings.version': 'เวอร์ชัน', 'settings.device': 'ชื่อเครื่อง',
    'settings.connected': 'เชื่อมต่อแล้ว', 'settings.disconnected': 'ไม่ได้เชื่อมต่อ', 'settings.on': 'เปิด', 'settings.off': 'ปิด',
    'common.cancel': 'ยกเลิก', 'common.back': 'ย้อนกลับ', 'common.error': 'เกิดข้อผิดพลาด: {msg}',
    'profiles.title': 'ใครกำลังดูอยู่', 'profiles.add': 'เพิ่มโปรไฟล์', 'profiles.name': 'ชื่อโปรไฟล์', 'profiles.rename': 'เปลี่ยนชื่อ',
    'profiles.delete': 'ลบโปรไฟล์', 'profiles.switched': 'สลับเป็น {name} แล้ว',
    'time.hm': '{h} ชม. {m} นาที', 'time.m': '{m} นาที',
    'icons.change': 'เปลี่ยนไอคอน', 'icons.changeHint': 'ค้นหาไอคอนขนาดใหญ่จากอินเทอร์เน็ต',
    'icons.title': 'เลือกไอคอนสำหรับ {name}', 'icons.text': 'ไอคอนที่พบจากอินเทอร์เน็ต เลือกอันที่ต้องการใช้',
    'icons.searching': 'กำลังค้นหาไอคอน…', 'icons.none': 'ไม่พบไอคอนเพิ่มเติม', 'icons.keep': 'ใช้ไอคอนเดิม',
    'icons.reset': 'กลับไปใช้ไอคอนของ Windows', 'icons.saving': 'กำลังบันทึกไอคอน…', 'icons.saved': 'เปลี่ยนไอคอน {name} แล้ว',
    'apps.fullscreenOn': 'เปิดแบบเต็มจอ: เปิดอยู่', 'apps.fullscreenOff': 'เปิดแบบเต็มจอ: ปิดอยู่', 'apps.fullscreenHint': 'ขยายหน้าต่างแอปให้เต็มจอเมื่อเปิด',
    'settings.appsFullscreen': 'เปิดแอปแบบเต็มจอ', 'settings.appsFullscreenHint': 'ขยายหน้าต่างของแอปที่เปิดให้เต็มจอทีวี',
    'profiles.kind.admin': 'ผู้ดูแล (Windows)', 'profiles.kind.standard': 'ผู้ใช้ทั่วไป', 'profiles.kind.kids': 'เด็ก',
    'profiles.standardHint': 'เช่น แม่, พ่อ — มีแอปโปรดของตัวเอง', 'profiles.kidsHint': 'จำกัดแอป เนื้อหา และเวลาดูได้',
    'profiles.kidsCreated': 'สร้างโปรไฟล์เด็กแล้ว ตั้งค่าแอป/เวลาได้ที่ การตั้งค่า › ควบคุมโดยผู้ปกครอง',
    'profiles.fromWindows': 'ชื่อและรูปมาจากบัญชี Windows', 'profiles.fromWindowsHint': 'เปลี่ยนได้ที่ การตั้งค่า Windows › บัญชี',
    'apps.rename': 'เปลี่ยนชื่อ', 'apps.renameHint': 'เว้นว่างเพื่อใช้ชื่อเดิม',
    'icons.fromFile': 'เลือกไฟล์จากเครื่อง', 'icons.fromFileHint': 'รูปภาพ หรือไฟล์ .exe / .ico', 'icons.fromWeb': 'ค้นหาจากอินเทอร์เน็ต',
    'row.kidsApps': 'แอปของหนู',
    'pin.enter': 'ใส่ PIN ผู้ปกครอง', 'pin.wrong': 'PIN ไม่ถูกต้อง', 'pin.current': 'ใส่ PIN ปัจจุบัน', 'pin.new': 'ตั้ง PIN ผู้ปกครอง',
    'pin.newHint': 'ตัวเลข 4–8 หลัก', 'pin.again': 'ใส่ PIN อีกครั้ง', 'pin.mismatch': 'PIN ไม่ตรงกัน', 'pin.saved': 'บันทึก PIN แล้ว',
    'pin.needed': 'ต้องตั้ง PIN ผู้ปกครองก่อนสร้างโปรไฟล์เด็ก', 'pin.setup': 'ตั้ง PIN ผู้ปกครอง', 'pin.change': 'เปลี่ยน PIN ผู้ปกครอง',
    'pin.toSwitch': 'ต้องใช้ PIN เพื่อออกจากโปรไฟล์เด็ก', 'pin.toSettings': 'การตั้งค่าสำหรับผู้ปกครองเท่านั้น',
    'pin.toParental': 'ต้องใช้ PIN ผู้ปกครอง', 'pin.toAddTime': 'ใส่ PIN เพื่อเพิ่มเวลา',
    'parental.title': 'ควบคุมโดยผู้ปกครอง', 'parental.sub': 'โหมดเด็ก: แอป เนื้อหา และเวลา', 'parental.addKid': 'เพิ่มโปรไฟล์เด็ก',
    'parental.today': 'ใช้ไปวันนี้ (นาที)', 'parental.limit': 'เวลาดูต่อวัน', 'parental.noLimit': 'ไม่จำกัด', 'parental.addTime': 'เพิ่มเวลาวันนี้ 30 นาที',
    'parental.timeAdded': 'เพิ่มเวลาให้ {name} แล้ว', 'parental.rating': 'เรตติ้งเนื้อหา', 'parental.apps': 'แอปที่อนุญาต',
    'parental.libraries': 'คลัง Plex ที่อนุญาต', 'parental.noApps': 'ยังไม่มีแอป — ให้ผู้ปกครองเพิ่มที่ การตั้งค่า › ควบคุมโดยผู้ปกครอง',
    'rating.young': 'เด็กเล็ก (G, TV-Y7)', 'rating.child': 'เด็ก (PG, TV-PG)', 'rating.teen': 'วัยรุ่น (PG-13, TV-14)', 'rating.all': 'ไม่จำกัด',
    'kids.left': 'เหลือ {n} นาที', 'kids.timeUp': 'หมดเวลาดูทีวีของวันนี้แล้ว', 'kids.timeUpText': 'พรุ่งนี้มาดูต่อกันนะ หรือให้ผู้ปกครองเพิ่มเวลาให้',
    'kids.moreTime': 'ผู้ปกครอง: เพิ่มเวลา 30 นาที', 'kids.switchUser': 'เปลี่ยนผู้ใช้',
  },
  en: {
    'tab.search': 'Search', 'tab.home': 'For you', 'tab.movies': 'Movies', 'tab.shows': 'Shows', 'tab.apps': 'Apps', 'tab.library': 'Library',
    'row.apps': 'Your apps', 'row.continue': 'Continue watching', 'row.picks': 'Top picks for you', 'row.recent': 'Recently added in {name}',
    'row.recentMovies': 'Recently added movies', 'row.recentShows': 'New episodes & shows',
    'row.related': 'More like this', 'row.libraries': 'Your libraries', 'row.allApps': 'All apps', 'row.episodes': 'Episodes',
    'row.movies': 'Movies', 'row.shows': 'Shows', 'row.searchApps': 'Apps', 'row.searchEpisodes': 'Episodes',
    'hero.new': 'New on {name}', 'hero.cta': 'Details',
    'hero.welcomeTitle': 'Welcome to X Launcher',
    'hero.welcomeText': 'Open your favorite apps from the row below, or connect Plex to see your movies and shows here.',
    'apps.add': 'Add app', 'apps.addProgram': 'Add a program (.exe)', 'apps.addWebsite': 'Add a website',
    'apps.showHidden': 'Show hidden apps ({n})', 'apps.hideHidden': 'Hide hidden apps',
    'apps.open': 'Open', 'apps.addFav': 'Add to Your apps', 'apps.removeFav': 'Remove from Your apps', 'apps.move': 'Move',
    'apps.hide': 'Hide app', 'apps.unhide': 'Unhide', 'apps.remove': 'Remove shortcut', 'apps.opening': 'Opening {name}…',
    'apps.moveHint': 'Use ← → to move, then press OK', 'apps.added': 'Added {name}', 'apps.removed': 'Removed {name}',
    'apps.hidden': '{name} is hidden', 'apps.emptyFav': 'Nothing here yet — in the Apps tab, long-press an app and choose "Add to Your apps".',
    'apps.websiteUrl': 'Website address', 'apps.websiteName': 'Display name', 'apps.howOpen': 'How should this site open?',
    'apps.tvMode': 'TV mode (remote friendly)', 'apps.tvModeHint': 'Smart-TV version of the site, e.g. YouTube',
    'apps.normalMode': 'Normal website', 'apps.normalModeHint': 'Full screen in Microsoft Edge',
    'apps.website': 'Website', 'apps.program': 'Program', 'apps.store': 'Microsoft Store', 'apps.desktop': 'Windows app',
    'details.play': 'Play', 'details.resume': 'Resume from {time}', 'details.startOver': 'Start over', 'details.playEp': 'Play {ep}',
    'details.markWatched': 'Mark watched', 'details.markUnwatched': 'Mark unwatched', 'details.director': 'Director', 'details.cast': 'Cast',
    'details.left': '{time} left', 'details.seasons': '{n} seasons', 'details.episodes': '{n} episodes', 'details.season': 'Season {n}',
    'play.opening': 'Opening in Plex HTPC…', 'play.opened': 'Plex HTPC is open — pick the title there', 'play.failed': 'Could not play: {msg}',
    'search.placeholder': 'Search movies, shows and apps', 'search.hint': "Type with the keys on the left or your remote's keyboard",
    'search.none': 'No results for "{q}"', 'search.searching': 'Searching…',
    'key.space': 'Space', 'key.clear': 'Clear', 'key.search': 'Search', 'key.ok': 'OK', 'key.lang': 'กขค', 'key.symbols': '.com',
    'sort.title': 'Title', 'sort.added': 'Recently added', 'sort.year': 'Year', 'sort.rating': 'Rating', 'filter.unwatched': 'Unwatched',
    'library.items': '{n} items', 'library.empty': 'No Plex libraries yet',
    'plex.offlineTitle': 'Plex is not connected', 'plex.offlineText': 'Make sure Plex Media Server is running, then refresh it in Settings > Plex.',
    'settings.title': 'Settings', 'settings.profile': 'Profile', 'settings.language': 'Language',
    'settings.plex': 'Plex', 'settings.plexServers': 'Servers: {n}', 'settings.plexNone': 'Not connected',
    'settings.serverThisPc': 'On this PC', 'settings.serverOwned': 'Your server', 'settings.serverShared': 'Shared with you',
    'settings.plexRefresh': 'Refresh servers', 'settings.plexAccount': 'Include servers shared with my account', 'settings.plexLibraries': 'Libraries shown',
    'settings.apps': 'Apps', 'settings.appsRefresh': 'Reload app list', 'settings.appsHidden': 'Hidden apps ({n})',
    'settings.ambient': 'Ambient mode', 'settings.ambientOn': 'Enabled', 'settings.ambientWait': 'Start after',
    'settings.ambientSource': 'Picture source', 'settings.ambientPlex': 'Plex artwork', 'settings.ambientFolder': 'Photo folder',
    'settings.ambientChoose': 'Choose photo folder', 'settings.ambientPreview': 'Preview now', 'settings.minutes': '{n} min',
    'settings.display': 'Display & resolution', 'settings.hdr': 'HDR', 'settings.sound': 'Sound', 'settings.network': 'Network',
    'settings.bluetooth': 'Bluetooth & remotes', 'settings.opensWindows': 'Opens Windows Settings',
    'settings.power': 'Power', 'settings.sleep': 'Sleep', 'settings.restart': 'Restart', 'settings.shutdown': 'Shut down', 'settings.quit': 'Exit X Launcher',
    'settings.confirm': '{action} now?', 'settings.about': 'About', 'settings.version': 'Version', 'settings.device': 'Device name',
    'settings.connected': 'Connected', 'settings.disconnected': 'Disconnected', 'settings.on': 'On', 'settings.off': 'Off',
    'common.cancel': 'Cancel', 'common.back': 'Back', 'common.error': 'Something went wrong: {msg}',
    'profiles.title': "Who's watching?", 'profiles.add': 'Add profile', 'profiles.name': 'Profile name', 'profiles.rename': 'Rename',
    'profiles.delete': 'Delete profile', 'profiles.switched': 'Switched to {name}',
    'time.hm': '{h} h {m} min', 'time.m': '{m} min',
    'icons.change': 'Change icon', 'icons.changeHint': 'Find a large icon on the internet',
    'icons.title': 'Choose an icon for {name}', 'icons.text': 'Icons found on the internet. Pick the one to use.',
    'icons.searching': 'Searching for icons…', 'icons.none': 'No other icons found', 'icons.keep': 'Keep current icon',
    'icons.reset': 'Use the Windows icon again', 'icons.saving': 'Saving icon…', 'icons.saved': '{name} has a new icon',
    'apps.fullscreenOn': 'Open full screen: On', 'apps.fullscreenOff': 'Open full screen: Off', 'apps.fullscreenHint': 'Make the app window fill the screen when it opens',
    'settings.appsFullscreen': 'Open apps full screen', 'settings.appsFullscreenHint': 'Make app windows fill the TV when they open',
    'profiles.kind.admin': 'Admin (Windows)', 'profiles.kind.standard': 'Standard', 'profiles.kind.kids': 'Kids',
    'profiles.standardHint': 'e.g. Mom, Dad — their own favorite apps', 'profiles.kidsHint': 'Limit apps, content and screen time',
    'profiles.kidsCreated': 'Kids profile created. Set apps and time in Settings › Parental controls',
    'profiles.fromWindows': 'Name and photo come from your Windows account', 'profiles.fromWindowsHint': 'Change them in Windows Settings › Accounts',
    'apps.rename': 'Rename', 'apps.renameHint': 'Leave empty to use the original name',
    'icons.fromFile': 'Choose a file on this PC', 'icons.fromFileHint': 'A picture, or an .exe / .ico file', 'icons.fromWeb': 'Search the internet',
    'row.kidsApps': 'My apps',
    'pin.enter': 'Enter parent PIN', 'pin.wrong': 'Wrong PIN', 'pin.current': 'Enter the current PIN', 'pin.new': 'Set a parent PIN',
    'pin.newHint': '4 to 8 digits', 'pin.again': 'Enter the PIN again', 'pin.mismatch': "The PINs don't match", 'pin.saved': 'PIN saved',
    'pin.needed': 'Set a parent PIN before creating a kids profile', 'pin.setup': 'Set parent PIN', 'pin.change': 'Change parent PIN',
    'pin.toSwitch': 'A PIN is needed to leave a kids profile', 'pin.toSettings': 'Settings are for parents only',
    'pin.toParental': 'Parent PIN required', 'pin.toAddTime': 'Enter the PIN to add time',
    'parental.title': 'Parental controls', 'parental.sub': 'Kids mode: apps, content and screen time', 'parental.addKid': 'Add a kids profile',
    'parental.today': 'Used today (minutes)', 'parental.limit': 'Daily screen time', 'parental.noLimit': 'No limit', 'parental.addTime': 'Add 30 minutes today',
    'parental.timeAdded': 'Added time for {name}', 'parental.rating': 'Content rating', 'parental.apps': 'Allowed apps',
    'parental.libraries': 'Allowed Plex libraries', 'parental.noApps': 'No apps yet — a parent can add some in Settings › Parental controls',
    'rating.young': 'Young kids (G, TV-Y7)', 'rating.child': 'Kids (PG, TV-PG)', 'rating.teen': 'Teens (PG-13, TV-14)', 'rating.all': 'No limit',
    'kids.left': '{n} min left', 'kids.timeUp': "TV time is over for today", 'kids.timeUpText': 'See you tomorrow, or ask a parent for more time',
    'kids.moreTime': 'Parent: add 30 minutes', 'kids.switchUser': 'Switch user',
  },
};

let lang = 'th';

export function setLang(value) {
  lang = STRINGS[value] ? value : 'th';
  document.documentElement.lang = lang;
}

export const getLang = () => lang;

export function t(key, vars) {
  let text = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, value);
  return text;
}

const locale = () => (lang === 'th' ? 'th-TH' : 'en-US');

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: lang === 'en' });
}

export function formatDate(date = new Date()) {
  return date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
}

/** 8130000 ms -> "2 h 15 min" */
export function formatDuration(ms) {
  const totalMinutes = Math.round((ms || 0) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? t('time.hm', { h, m }) : t('time.m', { m });
}

/** 3723000 ms -> "1:02:03" */
export function formatTimecode(ms) {
  const total = Math.floor((ms || 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
