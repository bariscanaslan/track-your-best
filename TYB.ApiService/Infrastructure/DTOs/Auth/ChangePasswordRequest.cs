using System.ComponentModel.DataAnnotations;

namespace TYB.ApiService.Infrastructure.DTOs.Auth
{
    public class ChangePasswordRequest
    {
        [Required]
        public string OldPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
