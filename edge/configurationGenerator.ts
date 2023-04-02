import Cheerio from 'cheerio'
import { schema } from 'stylus-supremacy'
import { execa } from 'execa'

const configs = Object.keys(schema)
	.filter(name => schema[name].hideInVSCE !== true)
	.map(name => {
		const item = { ...schema[name] }

		const $description = Cheerio.load('<p>' + item.description + '</p>').root()
		$description.find('.no-vsce').remove()
		item.description = $description.text().trim()

		delete item.example
		delete item.hideInDemo

		return ['stylusSupremacy.' + name, item]
	})

async function main() {
	console.log('Updating `contributes.configuration.properties` field in package.json')

	await execa('npm', ['pkg', 'delete', 'contributes.configuration.properties'])

	for (const [name, item] of configs) {
		await execa('npm', ['pkg', 'set', '--json', `contributes.configuration.properties[${name}]=${JSON.stringify(item)}`])
	}

	await execa('git', ['add', './package.json'])
}

main()
