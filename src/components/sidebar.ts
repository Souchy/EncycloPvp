import jsonBreeds from '../DofusDB/static/classes.json';
import { inject } from 'aurelia-dependency-injection'; //or framework
import { Router } from 'aurelia-router';

@inject(Router)
export class sidebar {
	public router: Router;
	// public breeds = jsonBreeds.names;
	public breeds: string[];
	public name:string = "robyn";

	constructor(router) {
		this.router = router;
		this.breeds = jsonBreeds.orderByIcon;
		console.log("sidebar breeds: " + this.breeds);
	}

}
