import {Router, RouterConfiguration} from 'aurelia-router';
import jsonBreeds from './DofusDB/static/classes.json';

export class App {
  public router: Router;

  public configureRouter(config: RouterConfiguration, router: Router): Promise<void> | PromiseLike<void> | void {
    config.title = 'EncycloPvp';
	// config.options.root = '/';
    config.map([
	  {
        route: '',
        name: 'home',
        moduleId: './home',
        nav: true,
        title: ''
	  },
	//   {
    //     route: 'hello',
    //     name: 'hello',
    //     moduleId: './hello',
    //     nav: true,
    //     title: ''
	//   },
    ]);

	for(let b of jsonBreeds.orderByIcon) {
		// console.log("app breed : " + b);
		config.map([
			{
			  route: "" + b,
			  name: b,
			  moduleId: './pages/breed',
			  nav: false,
			  title: '' + jsonBreeds.french[jsonBreeds.ids[b]-1]
			}
		]);
	}

    this.router = router;
  }
}
