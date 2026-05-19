/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const revieweeId = e.record.get("reviewee");
  const rating = e.record.get("rating");
  
  try {
    const reviewee = $app.findRecordById("users", revieweeId);
    
    // Get all reviews for this seller
    const allReviews = $app.findRecordsByFilter("reviews", "reviewee = '" + revieweeId + "'", {});
    
    let totalRating = 0;
    let count = 0;
    
    for (let i = 0; i < allReviews.length; i++) {
      totalRating += allReviews[i].get("rating");
      count++;
    }
    
    const avgRating = count > 0 ? totalRating / count : 0;
    
    reviewee.set("rating", avgRating);
    reviewee.set("reviewsCount", count);
    
    $app.save(reviewee);
  } catch (err) {
    console.log("Error updating seller rating: " + err.message);
  }
  
  e.next();
}, "reviews");