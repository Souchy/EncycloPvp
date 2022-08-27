import jsonBreeds from '../DofusDB/static/classes.json';
import jsonSpells from '../DofusDB/scraped/spells.json';
import { inject } from 'aurelia-dependency-injection'; //or framework
import { Router } from 'aurelia-router';
import {activationStrategy} from 'aurelia-router';
import { db } from 'DofusDB/static/db';
import details from '../details.json'


@inject(Router)
export class Breed {
	public router: Router;

	public breed: string = "null";
	// index number in the list of spells of the class, not the actual spell id
	public selectedSpellNumber: number = 0;


	constructor(router) {
		this.router = router;
		// console.log("breed ctor");
	}

	// public created() {
	// 	console.log("breed current route : " + this.getRoute());
	// }

	// public activate(params, routeConfig, navigationInstruction) {
	// 	try {
	// 		// this.breed = this.getRoute()
	// 	} catch(err) {
			
	// 	}
	// 	console.log("breed activate : " + this.breed);
	// }

	public created(owningView, myView) { // :View
		console.log("breed created route : " + this.breed);
		try {
			this.breed = this.getRoute()
		} catch(err) {
			
		}
	}

	// public bind(bindingContext: Object, overrideContext: Object) {
	// 	// this.breed = this.getRoute()
	// 	console.log("breed bind route : " + this.breed);
	// }

	// public attached() {
	// 	console.log("breed attached route : " + this.breed);
	// 	// this.breedName = this.getRoute();
	// }

	public getRoute() {
		return this.router.currentInstruction.config.name; //name of the route
		// return this.router.currentInstruction.config.moduleId; //moduleId of the route
	}

    determineActivationStrategy() {
		return activationStrategy.replace;
	}

	public selectSpell(id: number) {
		this.selectedSpellNumber = id;

	}

	public getId(): number {
		return jsonBreeds.ids[this.breed];
	}
	public getI18nName(): string {
		return jsonBreeds.french[this.getId()-1];
	}

	public getSpells(): any[] {
		return jsonSpells[this.breed];
	}

	public getSpell1(): any {
		return this.getSpells()[this.selectedSpellNumber];
	}

	public getSpell(num): any {
		return this.getSpells()[num];
	}
	public getSpellDescription() {
		return this.getSpell1().description;
	}
	public getSpellDescription2(num) {
		return this.getSpells()[num].description;
	}

	public getIcon(val: string) {
		// "val": "
		// <span class=\"ak-tooltip ak-icon-small ak-tx-actionpoints\" data-hasqtip=\"0\"></span>
		// <script type=\"application/json\">{\"manual\":true,\"tooltip\":{\"content\":{\"title\":\"\",\"text\":\"Points d'action\"},
		// \"style\":{\"classes\":\"ak-tooltip-content\"}},\"forceOnTouch\":true}</script>"
		if(val) {
			// let start = val.indexOf("ak-tx");
			// let iconClass = val.substring(start).split("\"")[0];
			// console.log("iconClass: " + iconClass);
			return db.getModIconStyle(val);
		}

		return "";
	}


	public getDetails(num) {
		let detail = details[this.getSpell(num).id];
		if(!detail) {
			return "";
		}
		let str: string = "";
		if(detail.text) {
			for(let s of detail.text) {
				str += db.insertEntityIcon(s);
				// str += "\n";
				str += "<br/>";
			}
		}
		if(detail.effects) {
			for(let s of detail.effects) {
				str += db.insertEntityIcon(s);
				// str += "\n";
				str += "<br/>";
			}
		}
		return str;
	}

}