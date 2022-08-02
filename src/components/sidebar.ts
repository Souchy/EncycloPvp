import jsonBreeds from '../DofusDB/static/classes.json';

export class sidebar {
	// public breeds = jsonBreeds.names;
	public breeds: string[];
	public name:string = "robyn";

	constructor() {
		this.breeds = jsonBreeds.names;
	}
}
