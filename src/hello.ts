export class Hello {

	public data: string = "some data";
	public counter: number = 0;

	public btnClick() {
		console.log("clicked btn");
		this.counter++;
	}
	
}
