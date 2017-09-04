const fs = require('fs')

if (fs.existsSync('./package-lock.json')) {
	const packageLock = JSON.parse(fs.readFileSync('./package-lock.json'))
	delete packageLock.dependencies['stylus-supremacy']
	fs.writeFileSync('./package-lock.json', JSON.stringify(packageLock, null, 2), 'utf-8')
}