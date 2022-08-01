import {Router, RouterConfiguration} from 'aurelia-router';

export class App {
  public router: Router;

  public configureRouter(config: RouterConfiguration, router: Router): Promise<void> | PromiseLike<void> | void {
    config.title = 'Aurelia';
    config.map([
		// {
		//   route: ['', 'breeds'],
		//   name: 'breeds',
		//   moduleId: './pages/breeds',
		//   nav: true,
		//   title: 'Classes'
		// },
      {
        route: ['', 'welcome'],
        name: 'welcome',
        moduleId: './welcome',
        nav: true,
        title: 'Welcome'
      },
      {
        route: 'users',
        name: 'users',
        moduleId: './users',
        nav: true,
        title: 'Github Users'
      },
      {
        route: 'child-router',
        name: 'child-router',
        moduleId: './child-router',
        nav: true,
        title: 'Child Router'
      }
    ]);

    this.router = router;
  }
}
