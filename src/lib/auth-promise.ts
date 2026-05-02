export function authPromise<T>(user: T) {
  return new Promise((resolve) => {
    console.log(user === undefined, "auth === undefined");
    function checkAuth() {
      if (user === undefined) {
        setTimeout(checkAuth, 50);
        console.log(user, "use5r in checkAuth after setTimeout");
        return;
      }

      console.log(user, "user in checkAuth");

      resolve(user);
    }

    console.log(user, "user in authPromise");

    checkAuth();
  });
}
