using RagMiddleware.Application.Contracts.Auth;
using RagMiddleware.Domain.Entities;

namespace RagMiddleware.Application.Abstractions.Security;

public interface IJwtTokenService
{
    JwtTokenResult CreateToken(
        ApplicationUser user
    );
}