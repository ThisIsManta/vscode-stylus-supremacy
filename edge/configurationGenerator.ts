import * as fs from 'fs'
import * as Cheerio from 'cheerio'
import { schema } from 'stylus-supremacy'

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))

packageJson.contributes.configuration.properties = Object.keys(schema)
	.filter(name => schema[name].hideInVSCE !== true)
	.map(name => {
		const item = { ...schema[name] }

		const $description = Cheerio.load('<p>' + item.description + '</p>').root()
		$description.find('.no-vsce').remove()
		item.description = $description.text().trim()

		delete item.example
		delete item.hideInDemo

		return [name, item]
	})
	.reduce((hash, pair) => {
		hash['stylusSupremacy.' + pair[0]] = pair[1]
		return hash
	}, {})

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '\t'))
